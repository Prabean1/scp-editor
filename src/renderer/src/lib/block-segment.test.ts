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

  it('keeps a bullet list together across a blank line', () => {
    const source = '* a\n\n* b\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual([source])
  })

  // Without this, a numbered list split by a blank line would restart its
  // numbering at 1 partway through.
  it('keeps a numbered list together across a blank line', () => {
    const source = '# a\n\n# b\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual([source])
  })

  it('splits between a bullet list and a numbered list, matching ftml\'s own list termination', () => {
    const source = '* a\n\n# b\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['* a\n\n', '# b\n'])
  })

  it('keeps an indented sub-item with its parent list across a blank line', () => {
    const source = '* a\n\n  * b\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual([source])
  })

  it('keeps a > blockquote run together across a blank line', () => {
    const source = '> a\n\n> b\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual([source])
  })

  it('still splits a blockquote from the paragraph after it', () => {
    const source = '> a\n\nb\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['> a\n\n', 'b\n'])
  })

  // Pinned deliberately, not a bug: ftml's own whole-document render also ends a pipe table
  // at a blank line (confirmed separately), so splitting here matches ftml, not just our guess.
  it('splits a pipe table at a blank line, matching ftml\'s own table termination', () => {
    const source = '||a||b||\n\n||c||d||\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['||a||b||\n\n', '||c||d||\n'])
  })

  it('does not treat a mid-sentence asterisk as a list item', () => {
    const source = 'five * three = fifteen\n\nnext\n'
    const chunks = segmentTokens(source, tokenize(source))
    expect(reassemble(chunks)).toBe(source)
    expect(chunks).toEqual(['five * three = fifteen\n\n', 'next\n'])
  })
})

describe('structural fidelity vs whole-document render', () => {
  const PAGE_INFO = {
    page: 'test',
    category: null,
    site: 'scp-wiki',
    title: 'Test',
    alt_title: null,
    score: 0,
    tags: [],
    language: 'en'
  }

  function render(source: string): string {
    const settings = ftml.WikitextSettings.from_mode('page', 'wikidot')
    const info = new ftml.PageInfo(PAGE_INFO)
    const tokenization = ftml.tokenize(ftml.preprocess(source))
    const outcome = ftml.parse(tokenization, info.copy(), settings.copy())
    return ftml.render_html(outcome.syntax_tree(), info, settings).body()
  }

  function tagCount(html: string, tag: string): number {
    return (html.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length
  }

  const fixtures = [
    ['bullet list', '* a\n\n* b\n'],
    ['numbered list', '# a\n\n# b\n'],
    ['blockquote', '> a\n\n> b\n'],
    ['pipe table', '||a||b||\n\n||c||d||\n'],
    ['nested list', '* a\n\n  * b\n'],
    ['list, prose, list', '* a\n\nprose\n\n* b\n']
  ] as const

  for (const [name, source] of fixtures) {
    it(`${name}: per-block render has the same tag counts as one whole-document render`, () => {
      const chunks = segmentTokens(source, tokenize(source))
      const whole = render(source)
      const perBlock = chunks.map(render).join('')
      for (const tag of ['ol', 'ul', 'blockquote', 'table']) {
        expect(tagCount(perBlock, tag)).toBe(tagCount(whole, tag))
      }
    })
  }
})
