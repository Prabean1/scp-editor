// ProseMirror/TipTap doc JSON -> Wikidot text, inverse of ftml-ast.ts's astToPmNodes.
// Only emits syntax the schema already knows is valid; never interprets arbitrary text.
import type { PmMark, PmNode } from './ftml-ast'

const MARK_SYNTAX: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['//', '//'],
  underline: ['__', '__'],
  strike: ['--', '--'],
  subscript: [',,', ',,'],
  superscript: ['^^', '^^']
}

// Innermost-first. Used standalone for a link's label since astToPmNodes only
// emits a link mark when nothing else is open, so it never joins the mark stack below.
function wrapSimple(text: string, marks: PmMark[]): string {
  let result = text
  for (let i = marks.length - 1; i >= 0; i--) {
    const [open, close] = MARK_SYNTAX[marks[i].type]
    result = open + result + close
  }
  return result
}

// Merging first avoids emitting e.g. `**a****b**` for one bold run that
// ProseMirror sometimes leaves split across two nodes after an edit.
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

// Marks form a stack, outermost first. Emitting open/close tokens only for the part that changes
// between runs keeps "**bold //italic// text**" from round-tripping wrong.
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

// A trailing blank-line run is what keeps a block distinct from the next on re-parse;
// rawBlock text already carries it, rich blocks don't, so it's added here.
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
