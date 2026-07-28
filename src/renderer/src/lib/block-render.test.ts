import { createRequire } from 'module'
import { describe, expect, it } from 'vitest'
import { countFootnotes, renumberFootnotes, suppressBlockFootnoteList } from './block-render'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ftml = require('../../../../resources/ftml-pkg/ftml.js')

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

function render(source: string): { html: string; errors: unknown[] } {
  const settings = ftml.WikitextSettings.from_mode('page', 'wikidot')
  const info = new ftml.PageInfo(PAGE_INFO)
  const tokenization = ftml.tokenize(ftml.preprocess(source))
  const outcome = ftml.parse(tokenization, info.copy(), settings.copy())
  const htmlOutput = ftml.render_html(outcome.syntax_tree(), info, settings)
  return { html: htmlOutput.body(), errors: outcome.errors() }
}

describe('suppressBlockFootnoteList', () => {
  it('leaves a block with no footnote byte-identical', () => {
    const source = 'Just a plain paragraph.\n'
    expect(suppressBlockFootnoteList(source)).toBe(source)
  })

  it('appends a hidden footnote block to a block containing [[footnote]]', () => {
    const source = 'Alpha.[[footnote]]first note[[/footnote]] end.'
    expect(suppressBlockFootnoteList(source)).toBe(
      source + '\n[[footnoteblock hide="true"]]'
    )
  })

  it('leaves a block that already has its own [[footnoteblock]] alone', () => {
    const source = 'Alpha.[[footnote]]first note[[/footnote]]\n[[footnoteblock]]'
    expect(suppressBlockFootnoteList(source)).toBe(source)
  })

  it('suppresses ftml\'s auto-appended footnote list while keeping the inline marker', () => {
    const source = 'Alpha.[[footnote]]first note[[/footnote]] end.'

    const before = render(source)
    expect(before.html).toContain('wj-footnote-list')

    const after = render(suppressBlockFootnoteList(source))
    expect(after.html).toContain('wj-footnote-ref-marker')
    expect(after.html).not.toContain('wj-footnote-list')
    expect(after.errors).toEqual([])
  })
})

describe('countFootnotes', () => {
  it('counts zero for a block with no footnote', () => {
    expect(countFootnotes('Just a plain paragraph.')).toBe(0)
  })

  it('counts multiple footnotes in one block', () => {
    const source = 'Alpha.[[footnote]]first[[/footnote]] Beta.[[footnote]]second[[/footnote]]'
    expect(countFootnotes(source)).toBe(2)
  })
})

describe('renumberFootnotes', () => {
  it('leaves html untouched at offset 0', () => {
    const source = 'Alpha.[[footnote]]first note[[/footnote]] end.'
    const html = render(suppressBlockFootnoteList(source)).html
    expect(renumberFootnotes(html, 0)).toBe(html)
  })

  it('shifts every marker and tooltip label by the offset', () => {
    const source = 'Alpha.[[footnote]]first[[/footnote]] Beta.[[footnote]]second[[/footnote]]'
    const html = render(suppressBlockFootnoteList(source)).html
    const shifted = renumberFootnotes(html, 2)

    expect(shifted).toContain('aria-label="Footnote 3."')
    expect(shifted).toContain('data-id="3"')
    expect(shifted).toContain('>3</wj-footnote-ref-marker>')
    expect(shifted).toContain('aria-label="Footnote 4."')
    expect(shifted).toContain('data-id="4"')
    expect(shifted).toContain('>4</wj-footnote-ref-marker>')
    expect(shifted).not.toContain('Footnote 1.')
    expect(shifted).not.toContain('Footnote 2.')
  })
})
