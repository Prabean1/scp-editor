import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import { segmentTokens, reassemble, type FtmlToken } from './block-segment'
import { STARTER } from '../hooks/useDocument'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ftml = require('../../../../resources/ftml-pkg/ftml.js')

// Mirrors ftml-bridge.ts's tokenizeWikitext: no preprocess() call — it normalizes CRLF/tabs/
// blank-line runs, which would shift token spans away from this raw source string.
function tokenize(source: string): FtmlToken[] {
  return ftml.tokenize(source).tokens()
}

describe('segmentTokens', () => {
  it('segments the STARTER sample doc into 9 blocks, matching the old regex implementation byte-for-byte', () => {
    const chunks = segmentTokens(STARTER, tokenize(STARTER))
    expect(reassemble(chunks)).toBe(STARTER)
    expect(chunks).toHaveLength(9)
    expect(chunks[0]).toBe('[[module Rate]]\n\n')
    expect(chunks[6]).toContain('[[collapsible')
    expect(chunks[6]).toContain('[[/collapsible]]')
  })

  it('keeps a [[div]] block with an internal blank line as one chunk, and splits after it closes', () => {
    const source = '[[div]]\na\n\nb\n[[/div]]\n\nafter\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['[[div]]\na\n\nb\n[[/div]]\n\n', 'after\n'])
  })

  it('splits on a CRLF blank line, which the old raw-text regex could not match', () => {
    const source = 'first\r\n\r\nsecond\r\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['first\r\n\r\n', 'second\r\n'])
  })

  it('lets an unclosed [[div]] at EOF absorb everything after it', () => {
    const source = 'before\n\n[[div]]\nunclosed\n\nstill inside\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['before\n\n', '[[div]]\nunclosed\n\nstill inside\n'])
  })

  it('does not let a self-closing [[include ...]] inflate depth', () => {
    const source = '[[include component:x]]\n\nafter\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['[[include component:x]]\n\n', 'after\n'])
  })

  it('does not go negative depth on a stray orphan close tag', () => {
    const source = '[[/div]]\n\nafter\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['[[/div]]\n\n', 'after\n'])
  })

  it('keeps a [[code]] block with an internal blank line as one chunk', () => {
    // Real SCP articles use blank lines inside [[code]] for tabular report layouts;
    // keeping this as one chunk depends on 'code' staying in PAIRED_TAGS.
    const source = '[[code]]\nrow one\n\nrow two\n[[/code]]\n\nafter\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['[[code]]\nrow one\n\nrow two\n[[/code]]\n\n', 'after\n'])
  })

  it('keeps a [[div_ ...]] block as one chunk even though it closes as plain [[/div]]', () => {
    const source = '[[div_ class="x"]]\na\n\nb\n[[/div]]\n\nafter\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['[[div_ class="x"]]\na\n\nb\n[[/div]]\n\n', 'after\n'])
  })

  it('documents a known limitation: a tag-shaped string inside a quoted attribute still closes early', () => {
    // ftml's lexer doesn't resolve quoting (only the full parser does, and that has no spans),
    // so a literal "[[/div]]" inside a quoted attribute value tokenizes as a real left-block-end.
    const source = '[[div class="close with [[/div]] inside quotes"]]\n\nafter\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual([
      '[[div class="close with [[/div]] inside quotes"]]\n\n',
      'after\n'
    ])
  })

  it('keeps a footnote marker and its body together even across a blank line inside it', () => {
    const source = 'text.[[footnote]]note one\n\nnote two[[/footnote]] more.\n\nnext block.\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual([
      'text.[[footnote]]note one\n\nnote two[[/footnote]] more.\n\n',
      'next block.\n'
    ])
  })
})
