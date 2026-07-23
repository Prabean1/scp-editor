// Powers WysiwygEditor.tsx's block-based hybrid editing (see
// .scratch/wysiwyg-mode/spec.md). Chunking, not parsing: this never
// interprets what Wikidot markup means, only where it's structurally safe
// to cut the raw text so each chunk can still be handed to ftml on its
// own. ftml stays the only thing that understands Wikidot semantics.
//
// Heuristic: split on blank-line runs, but only where "block depth" is 0.
// Depth is tracked via a hardcoded allow-list of constructs known to need a
// matching [[/tag]] close (div, collapsible, table, etc.) — self-closing
// constructs like [[include ...]] and [[module Rate]] are deliberately not
// tracked, since they never have a closing tag to wait for. This allow-list
// is exactly the kind of thing that goes stale or misses real-wiki
// constructs; replacing it with something derived from ftml's actual parse
// tree is tracked separately —
// see .scratch/wysiwyg-segmentation-hardening/spec.md.
const PAIRED_TAGS = new Set([
  'div',
  'span',
  'collapsible',
  'table',
  'tabview',
  'tab',
  'iftags',
  'size',
  'html'
])

const TAG_RE = /\[\[(\/?)([a-zA-Z][\w-]*)/g
const BLANK_RUN_RE = /\n[ \t]*\n+/g

interface TagMatch {
  index: number
  closing: boolean
  name: string
}

function findTags(source: string): TagMatch[] {
  const matches: TagMatch[] = []
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(source))) {
    matches.push({ index: m.index, closing: Boolean(m[1]), name: m[2].toLowerCase() })
  }
  return matches
}

// Splits `source` into an ordered list of chunks that concatenate back to
// the exact original string — reassemble(segment(s)) === s always, by
// construction (each chunk is a plain slice, split points come straight
// from indices in `source`, nothing is trimmed or normalized).
export function segment(source: string): string[] {
  const tags = findTags(source)
  const splitPoints: number[] = []

  let depth = 0
  let tagPtr = 0
  BLANK_RUN_RE.lastIndex = 0
  let bm: RegExpExecArray | null
  while ((bm = BLANK_RUN_RE.exec(source))) {
    while (tagPtr < tags.length && tags[tagPtr].index < bm.index) {
      const tag = tags[tagPtr]
      if (PAIRED_TAGS.has(tag.name)) {
        depth += tag.closing ? -1 : 1
        if (depth < 0) depth = 0 // stray close tag — don't go negative
      }
      tagPtr++
    }
    if (depth === 0) splitPoints.push(BLANK_RUN_RE.lastIndex)
  }

  const blocks: string[] = []
  let prev = 0
  for (const point of splitPoints) {
    blocks.push(source.slice(prev, point))
    prev = point
  }
  blocks.push(source.slice(prev))

  return blocks.filter((b) => b.length > 0)
}

export function reassemble(blocks: string[]): string {
  return blocks.join('')
}
