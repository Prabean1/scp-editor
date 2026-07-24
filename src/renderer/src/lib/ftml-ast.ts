// Shapes and helpers for ftml's syntax tree (`ParseOutcome.syntax_tree().data()`,
// exposed via window.api.parseWikitext). This is ftml's own AST, not a
// homegrown parser — see CLAUDE.md and .scratch/rich-text-inline-editing/spec.md
// for why that distinction matters here. Only the element/container types
// Rich Text v2 actually needs to walk are typed here.
//
// Real ast.elements/container.elements arrays can also contain kinds this
// file has no shape for (list, table, collapsible, ...) — deliberately not
// added as a fourth union member: a wildcard `{ element: string; data:
// unknown }` arm has a non-literal discriminant, which defeats
// discriminated-union narrowing for the *other* three arms too (TS can't
// rule the wildcard out when narrowing on `el.element === 'text'`, so
// `el.data` comes back as `unknown` even for the text case — confirmed by
// tsc). classifyChunk's `element !== 'container' -> raw` check works fine
// against a 3-member union at runtime regardless of what the real payload
// contains; TS just doesn't need a name for those other kinds anywhere in
// this file.
export interface FtmlAst {
  elements: FtmlElement[]
}

export type FtmlElement =
  | { element: 'text'; data: string }
  | { element: 'container'; data: FtmlContainer }
  | { element: 'link'; data: FtmlLink }
  // A mid-paragraph line-wrap (single `\n` in the source, as opposed to the
  // blank-line-run that block-segment.ts splits on) — confirmed empirically
  // that ftml renders this as a real `<br>`, not just collapsed whitespace,
  // so it's supported rather than forcing every hand-wrapped paragraph
  // (the overwhelmingly common case in real SCP article source) to a raw
  // island. Carries no `data`.
  | { element: 'line-break' }

export type FtmlContainerType =
  | { header: { level: number; 'has-toc': boolean } }
  | 'paragraph'
  | 'bold'
  | 'italics'
  | 'underline'
  | 'strikethrough'
  | 'subscript'
  | 'superscript'
  | string // any other container type — unsupported

export interface FtmlContainer {
  type: FtmlContainerType
  attributes: Record<string, unknown>
  elements: FtmlElement[]
}

export interface FtmlLink {
  type: string
  // 'direct' (bare/external URL) carries a plain string; 'page' (same- or
  // cross-site wiki page) carries a struct whose Rust `Option` fields come
  // through wasm-bindgen as *present keys with an `undefined` value*, not
  // absent keys — confirmed empirically, and the reason a naive
  // `Object.values(link)[0]` guess is wrong (it grabs `site`, not `page`,
  // whenever `site` precedes `page` in struct field order).
  link: string | { site?: string; page: string; extra?: unknown }
  label: { text: string } | unknown
}

const SUPPORTED_INLINE_TYPES = new Set([
  'bold',
  'italics',
  'underline',
  'strikethrough',
  'subscript',
  'superscript'
])

function isHeaderType(
  type: FtmlContainerType
): type is { header: { level: number; 'has-toc': boolean } } {
  return typeof type === 'object' && type !== null && 'header' in type
}

function flattenText(elements: FtmlElement[]): string {
  let out = ''
  for (const el of elements) {
    if (el.element === 'text') {
      out += el.data
    } else if (el.element === 'container') {
      out += flattenText((el.data as FtmlContainer).elements)
    } else if (el.element === 'link') {
      const label = (el.data as FtmlLink).label
      out +=
        typeof label === 'object' && label !== null && 'text' in label
          ? (label as { text: string }).text
          : ''
    }
    // 'line-break' contributes no text (falls through, appends nothing);
    // any other element type can't appear inside a chunk classifyChunk
    // already accepted (see isSupportedInline).
  }
  return out
}

// Only link shapes the serializer can losslessly reconstruct: a bare/
// external URL, or a same-/cross-site page reference with no `extra`
// (anchor/fragment) part — that syntax hasn't been verified yet, so a link
// carrying one is treated as unsupported (raw island) rather than guessed at.
function isSupportedLinkTarget(link: FtmlLink): boolean {
  if (link.type === 'direct') return typeof link.link === 'string'
  if (link.type === 'page' && typeof link.link === 'object' && link.link !== null) {
    return link.link.extra === undefined || link.link.extra === null
  }
  return false
}

// `insideFormatting` is true once we've recursed into a bold/italic/etc
// container. A link nested inside other formatting (e.g. bold wrapping a
// link) is deliberately treated as unsupported rather than reconstructed:
// ftml's AST doesn't distinguish "the whole span including the link syntax
// was bold" from "the link's label happens to also be bold", so a faithful
// byte-for-byte serialization of that case isn't straightforward — and a
// *visually*-equivalent-but-differently-worded reformat would violate the
// "never touch text you didn't mean to edit" round-trip guarantee. Plain
// top-level links (not wrapped in other marks) aren't affected.
function isSupportedInline(el: FtmlElement, insideFormatting: boolean): boolean {
  if (el.element === 'text') return true
  if (el.element === 'line-break') return true
  if (el.element === 'link') {
    if (insideFormatting) return false
    const link = el.data as FtmlLink
    const label = link.label
    const hasTextLabel = typeof label === 'object' && label !== null && 'text' in label
    return hasTextLabel && isSupportedLinkTarget(link)
  }
  if (el.element === 'container') {
    const c = el.data as FtmlContainer
    return (
      typeof c.type === 'string' &&
      SUPPORTED_INLINE_TYPES.has(c.type) &&
      c.elements.every((e) => isSupportedInline(e, true))
    )
  }
  return false
}

// A chunk (one block-segment.ts slice) is rich-eligible only if every
// top-level element is a plain header/paragraph made entirely of supported
// inline content, AND none of that content contains literal, un-parsed
// Wikidot bracket syntax — an unresolved [[include]]/[[module]] degrades to
// ordinary text elements (confirmed empirically against
// resources/ftml-pkg), which would otherwise look "rich-eligible" while
// actually being raw markup leaking into the WYSIWYG surface. When in
// doubt this returns 'raw' — a raw island is always safe, a wrongly-rich
// chunk risks losing markup on serialization.
export function classifyChunk(ast: FtmlAst): 'rich' | 'raw' {
  for (const el of ast.elements) {
    if (el.element !== 'container') return 'raw'
    const c = el.data as FtmlContainer
    const isHeader = isHeaderType(c.type)
    const isParagraph = c.type === 'paragraph'
    if (!isHeader && !isParagraph) return 'raw'
    if (!c.elements.every((e) => isSupportedInline(e, false))) return 'raw'
    if (flattenText(c.elements).includes('[[') || flattenText(c.elements).includes(']]'))
      return 'raw'
  }
  return 'rich'
}

// --- AST -> ProseMirror/TipTap doc JSON -------------------------------

export interface PmMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface PmNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
  marks?: PmMark[]
  text?: string
}

const MARK_FOR_CONTAINER_TYPE: Record<string, string> = {
  bold: 'bold',
  italics: 'italic',
  underline: 'underline',
  strikethrough: 'strike',
  subscript: 'subscript',
  superscript: 'superscript'
}

function walkInline(elements: FtmlElement[], marks: PmMark[]): PmNode[] {
  const out: PmNode[] = []
  for (const el of elements) {
    if (el.element === 'text') {
      if (el.data.length === 0) continue
      out.push(
        marks.length > 0 ? { type: 'text', text: el.data, marks } : { type: 'text', text: el.data }
      )
    } else if (el.element === 'line-break') {
      // Unmarked regardless of ambient `marks` — a break isn't itself bold/
      // italic/etc, and leaving the mark stack untouched around it is what
      // makes the serializer's stack-diffing reproduce e.g.
      // "**bold\nmore bold**" instead of closing and reopening bold across
      // the break.
      out.push({ type: 'hardBreak' })
    } else if (el.element === 'link') {
      const link = el.data as FtmlLink
      const label = link.label as { text: string }
      const href = linkHref(link)
      out.push({
        type: 'text',
        text: label.text,
        marks: [...marks, { type: 'link', attrs: { href } }]
      })
    } else if (el.element === 'container') {
      const c = el.data as FtmlContainer
      const markType = MARK_FOR_CONTAINER_TYPE[c.type as string]
      out.push(...walkInline(c.elements, markType ? [...marks, { type: markType }] : marks))
    }
  }
  return out
}

// Only called after isSupportedLinkTarget has confirmed the shape (see
// astToPmNodes' invariant note) — the '' fallback is unreachable in
// practice, kept only so this stays a total function.
function linkHref(link: FtmlLink): string {
  if (link.type === 'direct' && typeof link.link === 'string') return link.link
  if (link.type === 'page' && typeof link.link === 'object' && link.link !== null) {
    const { site, page } = link.link
    return site ? `:${site}:${page}` : page
  }
  return ''
}

// Converts one rich-eligible chunk's AST into a ProseMirror doc's `content`
// array (one entry per top-level heading/paragraph). Only call this after
// classifyChunk(ast) === 'rich' — it assumes that invariant and does not
// re-validate.
export function astToPmNodes(ast: FtmlAst): PmNode[] {
  return ast.elements.map((el) => {
    const c = (el as { element: 'container'; data: FtmlContainer }).data
    if (isHeaderType(c.type)) {
      return {
        type: 'heading',
        attrs: { level: c.type.header.level },
        content: walkInline(c.elements, [])
      }
    }
    return { type: 'paragraph', content: walkInline(c.elements, []) }
  })
}
