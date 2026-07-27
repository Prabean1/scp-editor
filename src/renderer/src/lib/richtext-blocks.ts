// Pure block-geometry math for Rich Text's merge/split feature — no DOM dependency,
// so it's usable from both caret-driven and click-position split paths.
import type { Node as PMNode } from '@tiptap/pm/model'
import { serializeDoc } from './wikidot-serializer'
import type { PmNode } from './ftml-ast'

export interface BlockEntry {
  node: PMNode
  from: number
  to: number
  index: number
}

// Rebuilt fresh on every context-menu open rather than cached, since the doc changes on every edit.
export function getTopLevelBlocks(doc: PMNode): BlockEntry[] {
  const blocks: BlockEntry[] = []
  doc.forEach((node, offset, index) => {
    blocks.push({ node, from: offset, to: offset + node.nodeSize, index })
  })
  return blocks
}

// rawBlock's `raw` attr is already Wikidot text; a rich node has to go through the same serializer.
export function nodeRawText(node: PMNode): string {
  if (node.type.name === 'rawBlock') return (node.attrs.raw as string) ?? ''
  return serializeDoc({ type: 'doc', content: [node.toJSON() as PmNode] })
}

// Exactly one '\n' junction, never a blank-line run: a rawBlock's raw text usually ends in
// its own blank-line run, which left alone would make the merge silently re-split itself.
export function joinForMerge(rawA: string, rawB: string): string {
  return rawA.replace(/\s+$/, '') + '\n' + rawB.replace(/^\s+/, '')
}

// Snaps to the nearest newline so a coarse click-position split never lands mid-line.
export function snapToNearestNewline(text: string, offset: number): number {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\n') continue
    const dist = Math.abs(i - offset)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best === -1 ? offset : best + 1
}

// Takes the rect as plain numbers rather than a live DOMRect so this stays callable with no DOM at all.
export function clientYToRawOffset(
  rawText: string,
  clientY: number,
  rectTop: number,
  rectHeight: number
): number {
  const fraction = rectHeight > 0 ? Math.min(1, Math.max(0, (clientY - rectTop) / rectHeight)) : 0.5
  return snapToNearestNewline(rawText, Math.round(rawText.length * fraction))
}

// Trims new edges so the blank-line junction callers insert doesn't get stray whitespace beside it.
// Returns null when there's nothing real to split off.
export function splitRawTextAt(
  raw: string,
  offset: number
): { before: string; after: string } | null {
  if (offset <= 0 || offset >= raw.length) return null
  const before = raw.slice(0, offset).replace(/\s+$/, '')
  const after = raw.slice(offset).replace(/^\s+/, '')
  if (!before || !after) return null
  return { before, after }
}
