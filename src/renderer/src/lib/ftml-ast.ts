// This is ftml's own AST (window.api.parseWikitext), not a homegrown parser.
// Only typing the element/container kinds Rich Text v2 needs to walk — real
// payloads can contain more (list, table, ...). Deliberately no wildcard
// union member: it defeats TS's discriminated-union narrowing for the other arms.
export interface FtmlAst {
  elements: FtmlElement[]
}

export type FtmlElement =
  | { element: 'text'; data: string }
  | { element: 'container'; data: FtmlContainer }
  | { element: 'link'; data: FtmlLink }
  // A mid-paragraph `\n` (not the blank-line run block-segment.ts splits on) —
  // ftml renders it as a real `<br>`, confirmed empirically, so it's kept
  // rather than forced into a raw island. Carries no `data`.
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
  // 'direct' carries a plain string; 'page' carries a struct. wasm-bindgen turns
  // Rust `Option` fields into present keys with `undefined` values, not absent
  // keys — so `Object.values(link)[0]` would wrongly grab `site` instead of `page`.
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
    // Any other element type can't appear in a chunk classifyChunk already accepted.
  }
  return out
}

// Anchor/fragment (`extra`) syntax hasn't been verified to round-trip safely,
// so a link carrying one is treated as unsupported (raw island) rather than guessed at.
function isSupportedLinkTarget(link: FtmlLink): boolean {
  if (link.type === 'direct') return typeof link.link === 'string'
  if (link.type === 'page' && typeof link.link === 'object' && link.link !== null) {
    return link.link.extra === undefined || link.link.extra === null
  }
  return false
}

// `insideFormatting` is true once recursed into a bold/italic/etc container.
// A link nested inside other formatting is treated as unsupported rather than
// reconstructed: ftml's AST doesn't distinguish "the link syntax itself was
// bold" from "the label happens to be bold", so it can't round-trip losslessly.
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

// An unresolved [[include]]/[[module]] degrades to plain text elements
// (confirmed against resources/ftml-pkg), which would otherwise look
// rich-eligible while actually being raw markup. Defaults to 'raw' when in
// doubt — always safe, unlike a wrongly-'rich' chunk losing markup on serialization.
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
      // Left unmarked regardless of ambient `marks` — keeping the mark stack
      // untouched here is what lets the serializer reproduce "**bold\nmore
      // bold**" instead of closing and reopening bold across the break.
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

// Only called once isSupportedLinkTarget has confirmed the shape; the ''
// fallback is unreachable in practice but keeps this a total function.
function linkHref(link: FtmlLink): string {
  if (link.type === 'direct' && typeof link.link === 'string') return link.link
  if (link.type === 'page' && typeof link.link === 'object' && link.link !== null) {
    const { site, page } = link.link
    return site ? `:${site}:${page}` : page
  }
  return ''
}

// Assumes classifyChunk(ast) === 'rich' has already been checked — does not re-validate.
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
