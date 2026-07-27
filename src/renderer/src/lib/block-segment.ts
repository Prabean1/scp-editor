// Chunking, not parsing: splits raw Wikidot source into blocks for
// RichTextEditor.tsx by walking ftml's own lexer tokens (not a regex) and
// tracking paired-tag nesting depth via a hardcoded allow-list (div, table,
// etc.) that goes stale as Wikidot/ftml add new paired block tags. ftml's
// lexer doesn't resolve quoting or nesting (only the full parser does, and
// that has no source spans) — a tag-shaped string inside a quoted attribute
// or a [[code]] block's body still tokenizes as a real tag, so this allow-
// list-plus-depth-counter approach has the same false-positive blind spot
// a raw-text regex would. What it does fix over a regex: CRLF line endings
// (a regex anchored on `\n` alone misses blank-line splits in CRLF text;
// ftml's own paragraph-break token doesn't). Corpus-validated against 20
// real scp-wiki.wikidot.com articles — 'code', 'footnote', 'bibliography',
// 'cell', 'row', 'tabs', 'div_' added on that evidence.
//
// 'div_' (whitespace-suppressing div variant) always closes as plain
// [[/div]], never [[/div_]] — works with this set's flat depth counter
// (not a per-name stack) without any extra aliasing logic, since any
// paired-tag open increments the same counter any paired-tag close
// decrements, regardless of whether the names match.
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
