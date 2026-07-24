// ProseMirror/TipTap doc JSON -> Wikidot text. The inverse of ftml-ast.ts's
// astToPmNodes, plus verbatim passthrough for rawBlock islands. This is a
// serializer, not a parser: it only ever emits syntax the schema already
// knows is valid, it never interprets arbitrary text (see CLAUDE.md /
// .scratch/rich-text-inline-editing/spec.md on why that distinction matters
// here).
import type { PmMark, PmNode } from './ftml-ast'

const MARK_SYNTAX: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['//', '//'],
  underline: ['__', '__'],
  strike: ['--', '--'],
  subscript: [',,', ',,'],
  superscript: ['^^', '^^']
}

// Wraps one run's own text in its (non-link) marks, innermost-first — used
// standalone for a link's label, which is never part of the cross-run stack
// below (ftml-ast.ts's astToPmNodes only emits a link mark when nothing else
// is open, see isSupportedInline's insideFormatting guard).
function wrapSimple(text: string, marks: PmMark[]): string {
  let result = text
  for (let i = marks.length - 1; i >= 0; i--) {
    const [open, close] = MARK_SYNTAX[marks[i].type]
    result = open + result + close
  }
  return result
}

// Adjacent text nodes with an identical mark set serialize the same whether
// merged or not, EXCEPT it avoids emitting e.g. `**a****b**` for what's
// conceptually one bold run split across two nodes (which ProseMirror does
// sometimes leave un-coalesced after an edit) — merging first keeps output
// closer to the original hand-written style.
function mergeAdjacentRuns(content: PmNode[]): PmNode[] {
  const merged: PmNode[] = []
  for (const node of content) {
    const prev = merged[merged.length - 1]
    if (
      node.type === 'text' &&
      prev?.type === 'text' &&
      JSON.stringify(prev.marks ?? []) === JSON.stringify(node.marks ?? [])
    ) {
      prev.text = (prev.text ?? '') + (node.text ?? '')
    } else {
      merged.push({ ...node })
    }
  }
  return merged
}

// Marks on a PmNode form a stack in nesting order (outermost first — see
// astToPmNodes' `[...marks, newMark]` accumulation), so two adjacent runs'
// mark stacks always share a common prefix. Emitting open/close tokens only
// for the part of the stack that actually changes between runs (rather than
// wrapping each run independently) is what keeps
// "**bold //italic-inside-bold// text**" from round-tripping into the
// malformed "**bold **//**italic-inside-bold**//** text**".
function serializeInline(content: PmNode[] | undefined): string {
  if (!content) return ''
  const runs = mergeAdjacentRuns(content)
  let out = ''
  const openStack: string[] = []

  function closeTo(n: number): void {
    while (openStack.length > n) {
      out += MARK_SYNTAX[openStack.pop() as string][1]
    }
  }

  for (const run of runs) {
    if (run.type === 'hardBreak') {
      // Deliberately doesn't touch openStack — see ftml-ast.ts's walkInline
      // note on why a break stays unmarked and mid-mark-run.
      out += '\n'
      continue
    }
    if (run.type !== 'text') continue
    const marks = run.marks ?? []
    const link = marks.find((m) => m.type === 'link')
    if (link) {
      closeTo(0)
      const href = typeof link.attrs?.href === 'string' ? link.attrs.href : ''
      out += `[[[${href}|${wrapSimple(
        run.text ?? '',
        marks.filter((m) => m.type !== 'link')
      )}]]]`
      continue
    }

    const stack = marks.map((m) => m.type)
    let common = 0
    while (
      common < openStack.length &&
      common < stack.length &&
      openStack[common] === stack[common]
    ) {
      common++
    }
    closeTo(common)
    for (let i = common; i < stack.length; i++) {
      out += MARK_SYNTAX[stack[i]][0]
      openStack.push(stack[i])
    }
    out += run.text ?? ''
  }
  closeTo(0)
  return out
}

function serializeBlock(node: PmNode): string {
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
    return '+'.repeat(level) + ' ' + serializeInline(node.content)
  }
  if (node.type === 'rawBlock') {
    return typeof node.attrs?.raw === 'string' ? node.attrs.raw : ''
  }
  // paragraph, or any other block type this schema doesn't specially handle
  return serializeInline(node.content)
}

// Ported from v1's RichTextEditor.tsx ensureBlockSeparation: a block's own
// trailing blank-line run is what keeps it distinct from the next block on
// re-parse (block-segment.ts bakes each block's separator into its own
// slice). rawBlock text already carries this from its original source slice
// (segment() is exact-by-construction); serialized rich blocks don't, so
// they need it added here. Idempotent either way — a text that already ends
// in a blank-line run is left alone.
function ensureSeparation(text: string, isLast: boolean): string {
  if (text.length === 0 || isLast) return text
  return /\n[ \t]*\n\s*$/.test(text) ? text : text.replace(/\s+$/, '') + '\n\n'
}

export function serializeDoc(doc: PmNode): string {
  const content = doc.content ?? []
  return content
    .map((node, i) => ensureSeparation(serializeBlock(node), i === content.length - 1))
    .join('')
}
