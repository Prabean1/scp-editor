import { describe, expect, it } from 'vitest'
import { unescapeSource } from './wikidot-source'

describe('unescapeSource', () => {
  it('strips the source viewer\'s anchor wrapper, keeping the link text (real page path)', () => {
    // Captured live from scp-wiki.wikidot.com's viewsource module for
    // component:image-block — real <a> markup, not entity-escaped.
    const escaped =
      '[[include <a href="http://scp-wiki.wikidot.com/component:image-block-base">' +
      ':scp-wiki:component:image-block-base</a> name={$name}|caption={$caption}]]'
    expect(unescapeSource(escaped)).toBe(
      '[[include :scp-wiki:component:image-block-base name={$name}|caption={$caption}]]'
    )
  })

  it('unescapes &amp; last, so a source-literal "&lt;" survives as text, not as "<"', () => {
    expect(unescapeSource('&amp;lt;')).toBe('&lt;')
  })

  it('converts <br> to newline and &nbsp; to a space', () => {
    expect(unescapeSource('a<br />b&nbsp;c')).toBe('a\nb c')
  })
})
