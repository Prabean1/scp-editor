import { describe, expect, it } from 'vitest'
import { serializeDoc, TRAILING_BLANK_RUN_RE } from './wikidot-serializer'
import type { PmNode } from './ftml-ast'

function rawBlock(raw: string): PmNode {
  return { type: 'rawBlock', attrs: { raw } }
}

describe('serializeDoc', () => {
  it('joins two separator-free rawBlocks with exactly one blank line', () => {
    const doc: PmNode = { type: 'doc', content: [rawBlock('a'), rawBlock('b')] }
    expect(serializeDoc(doc)).toBe('a\n\nb')
  })

  it('does not double the separator when a rawBlock still carries its own trailing blank line', () => {
    const doc: PmNode = { type: 'doc', content: [rawBlock('a\n\n'), rawBlock('b')] }
    expect(serializeDoc(doc)).toBe('a\n\nb')
  })

  it('keeps appended text inside the same block instead of producing a fresh separator', () => {
    // Raw with no trailing blank-line run: appending more text to it can never look like a
    // second block on re-parse.
    const appended = 'First paragraph...More text.' + '[[footnote]]New extra note.[[/footnote]]'
    const doc: PmNode = { type: 'doc', content: [rawBlock(appended), rawBlock('c')] }
    expect(serializeDoc(doc)).toBe(appended + '\n\nc')
  })

  it('adds no trailing separator after the last block', () => {
    const doc: PmNode = { type: 'doc', content: [rawBlock('a'), rawBlock('b')] }
    expect(serializeDoc(doc).endsWith('b')).toBe(true)
  })

  it('ignores a trailing empty paragraph (TrailingNode) when deciding what counts as last', () => {
    // TipTap's TrailingNode always appends a synthetic empty paragraph after a doc ending in an
    // atom (rawBlock) — that node must not count as "last".
    const doc: PmNode = {
      type: 'doc',
      content: [rawBlock('a'), rawBlock('b'), { type: 'paragraph', content: [] }]
    }
    expect(serializeDoc(doc)).toBe('a\n\nb')
  })

  it('does not double the separator when a rawBlock carries a CRLF trailing blank line', () => {
    const doc: PmNode = { type: 'doc', content: [rawBlock('a\r\n\r\n'), rawBlock('b')] }
    expect(serializeDoc(doc)).toBe('a\r\n\r\nb')
  })
})

describe('TRAILING_BLANK_RUN_RE', () => {
  it('matches a CRLF blank-line run, not just LF', () => {
    expect(TRAILING_BLANK_RUN_RE.test('a\r\n\r\n')).toBe(true)
    expect('a\r\n\r\n'.replace(TRAILING_BLANK_RUN_RE, '')).toBe('a')
  })

  it('matches a run of more than two line breaks', () => {
    expect('a\n\n\n'.replace(TRAILING_BLANK_RUN_RE, '')).toBe('a')
    expect('a\r\n\r\n\r\n'.replace(TRAILING_BLANK_RUN_RE, '')).toBe('a')
  })

  it('does not match a single trailing line break of either style', () => {
    expect(TRAILING_BLANK_RUN_RE.test('a\n')).toBe(false)
    expect(TRAILING_BLANK_RUN_RE.test('a\r\n')).toBe(false)
  })
})
