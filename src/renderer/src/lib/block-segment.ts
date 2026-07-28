// Walks ftml's lexer tokens (not regex) and tracks paired-tag depth via the allow-list below.
// The lexer can't resolve quoting, so tag-shaped text in a quoted attribute or [[code]] body is a known false-positive blind spot.
// Also suppresses a split when it would fall inside a bare list/blockquote run (no wrapping
// [[tag]], so depth-tracking above can't see these) — see lineKind below.
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

// Bare bullet/numbered lists and blockquotes have no wrapping [[tag]], so PAIRED_TAGS-style
// depth tracking can't see them. ftml's own RULE_LIST/RULE_BLOCKQUOTE (list.rs/blockquote.rs)
// only recognize these markers at start-of-line and keep a run going across a blank line as
// long as the next line starts the same way — transcribed here at the token level rather than
// reconciling against the AST, which carries no spans (see ADR-0004).
const LINE_KIND_TOKENS = new Set(['bullet-item', 'numbered-item', 'quote'])

// A line's kind is its first token, skipping ftml's own zero-width input-start marker and one
// level of indent whitespace (nested list items) — never a token found mid-line, so
// "five * three" doesn't read as a bullet item.
function lineKind(tokens: FtmlToken[], start: number): string | null {
  let i = start
  if (tokens[i]?.token === 'input-start') i++
  if (tokens[i]?.token === 'whitespace') i++
  const t = tokens[i]
  return t && LINE_KIND_TOKENS.has(t.token) ? t.token : null
}

// reassemble(segmentTokens(s, tokens)) === s always — chunks are plain
// slices, nothing trimmed or normalized.
export function segmentTokens(source: string, tokens: FtmlToken[]): string[] {
  const splitPoints: number[] = []
  let depth = 0
  let lineStart = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.token === 'left-block' || t.token === 'left-block-end') {
      const name = tokens[i + 1]
      if (name?.token === 'identifier' && PAIRED_TAGS.has(name.slice.toLowerCase())) {
        depth += t.token === 'left-block-end' ? -1 : 1
        if (depth < 0) depth = 0 // stray close tag — don't go negative
      }
    } else if (t.token === 'paragraph-break') {
      if (depth === 0) {
        const before = lineKind(tokens, lineStart)
        const after = lineKind(tokens, i + 1)
        const suppress = before !== null && before === after
        if (!suppress) splitPoints.push(t.span.end)
      }
      lineStart = i + 1
    } else if (t.token === 'line-break') {
      lineStart = i + 1
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
