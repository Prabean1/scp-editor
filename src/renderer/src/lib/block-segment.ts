// Walks ftml's lexer tokens (not regex) and tracks paired-tag depth via the allow-list below.
// The lexer can't resolve quoting, so tag-shaped text in a quoted attribute or [[code]] body is a known false-positive blind spot.
import type { FtmlToken } from '../../../shared/types'

export type { FtmlToken }

const PAIRED_TAGS = new Set([
  'div',
  'div_',
  'span',
  'collapsible',
  'table',
  'row',
  'cell',
  'tabview',
  'tab',
  'tabs',
  'iftags',
  'size',
  'html',
  'code',
  'footnote',
  'bibliography'
])

// reassemble(segmentTokens(s, tokens)) === s always — chunks are plain
// slices, nothing trimmed or normalized.
export function segmentTokens(source: string, tokens: FtmlToken[]): string[] {
  const splitPoints: number[] = []
  let depth = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.token === 'left-block' || t.token === 'left-block-end') {
      const name = tokens[i + 1]
      if (name?.token === 'identifier' && PAIRED_TAGS.has(name.slice.toLowerCase())) {
        depth += t.token === 'left-block-end' ? -1 : 1
        if (depth < 0) depth = 0 // stray close tag — don't go negative
      }
    } else if (t.token === 'paragraph-break' && depth === 0) {
      splitPoints.push(t.span.end)
    }
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

export async function segment(source: string): Promise<string[]> {
  const { tokens } = await window.api.tokenizeWikitext(source)
  return segmentTokens(source, tokens)
}

export function reassemble(blocks: string[]): string {
  return blocks.join('')
}
