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

// Round-tripped through serialization with the caret spliced in so its position in the output
// reflects however wikitext syntax actually shifted it, instead of assuming a raw-string-to-PM-position map.
export const CARET_MARKER = '⁣'

// Splits a rich node's inline content at a PM-relative inline offset (0 = right after the block
// opens), reserializes with CARET_MARKER spliced in, and reports where it landed in wikitext text.
export function rawTextWithCaret(
  node: PMNode,
  inlineOffset: number
): { raw: string; offset: number } {
  const json = node.toJSON() as PmNode
  const source = json.content ?? []
  const newContent: PmNode[] = []
  let pos = 0
  let inserted = false

  for (const child of source) {
    if (inserted) {
      newContent.push(child)
      continue
    }
    if (child.type === 'text') {
      const text = child.text ?? ''
      if (inlineOffset >= pos && inlineOffset <= pos + text.length) {
        const local = inlineOffset - pos
        // Only an interior split inherits the run's marks — at a run boundary, inheriting would
        // merge the marker into that run and nest it inside the mark's own closing syntax.
        const interior = local > 0 && local < text.length
        if (local > 0) newContent.push({ ...child, text: text.slice(0, local) })
        newContent.push({
          type: 'text',
          text: CARET_MARKER,
          marks: interior ? child.marks : undefined
        })
        if (local < text.length) newContent.push({ ...child, text: text.slice(local) })
        inserted = true
      } else {
        newContent.push(child)
      }
      pos += text.length
    } else {
      // Non-text inline node (hardBreak): one PM position, marker can only go before or after it.
      if (inlineOffset === pos) {
        newContent.push({ type: 'text', text: CARET_MARKER })
        inserted = true
      }
      newContent.push(child)
      pos += 1
    }
  }
  if (!inserted) newContent.push({ type: 'text', text: CARET_MARKER })

  const withMarker = serializeDoc({ type: 'doc', content: [{ ...json, content: newContent }] })
  const offset = withMarker.indexOf(CARET_MARKER)
  return {
    raw: withMarker.slice(0, offset) + withMarker.slice(offset + CARET_MARKER.length),
    offset
  }
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
