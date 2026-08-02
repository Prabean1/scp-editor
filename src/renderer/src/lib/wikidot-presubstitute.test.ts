import { describe, expect, it } from 'vitest'
import type { CachedInclude } from './include-cache'
import { BUNDLED_INCLUDE_META, getBundledInclude } from './bundled-includes'
import { presubstitute, collectIncludePaths } from './wikidot-presubstitute'

describe('bundled includes', () => {
  it('expands every bundled top-level path offline instead of leaving it unresolved', () => {
    // Some bundled pages carry their own dead documentation (gated behind
    // [[iftags +component]], which ftml hides for any real article — see
    // ftml-bridge.ts's default tags: []) with syntax examples this
    // regex-based substitution doesn't fully understand (Wikidot's
    // @@-escaped example blocks). That's pre-existing, not introduced here,
    // and harmless since it never renders — so this only checks the actual
    // top-level include got expanded, not that the whole page is free of
    // leftover bracket noise buried in dead text.
    for (const { path } of BUNDLED_INCLUDE_META) {
      const literal = `[[include ${path}]]`
      const out = presubstitute(literal, { onlineFeatures: false })
      expect(out).not.toBe(literal)
    }
  })

  it('handles a param sharing the include path\'s own line', () => {
    const out = presubstitute(
      '[[include component:image-block name=cat.png|caption=A cat]]',
      { onlineFeatures: false }
    )
    expect(out).toContain('cat.png')
    expect(out).toContain('A cat')
  })

  it('preserves a param value containing "=" (regression check)', () => {
    const out = presubstitute(
      '[[include component:image-block name=cat.png|caption=width=300 is neat]]',
      { onlineFeatures: false }
    )
    expect(out).toContain('width=300 is neat')
  })

  it('substitutes {$param} identically for bundle vs a stubbed live cache', () => {
    const bundled = presubstitute('[[include component:preview text=Hello there]]', {
      onlineFeatures: false
    })

    const cache = new Map<string, CachedInclude>([
      [
        'component:preview',
        { status: 'resolved', source: '[[div class="preview"]]\n{$text}\n[[/div]]' }
      ]
    ])
    const live = presubstitute('[[include component:preview text=Hello there]]', {
      onlineFeatures: true,
      getCached: (path) => cache.get(path)
    })

    expect(bundled).toContain('Hello there')
    expect(live).toContain('Hello there')
  })

  it('a resolved live cache entry wins over the bundle', () => {
    const cache = new Map<string, CachedInclude>([
      ['component:preview', { status: 'resolved', source: 'LIVE VERSION' }]
    ])
    const out = presubstitute('[[include component:preview]]', {
      onlineFeatures: true,
      getCached: (path) => cache.get(path)
    })
    expect(out).toContain('LIVE VERSION')
  })

  it('the bundle wins over a cached fetch error', () => {
    const cache = new Map<string, CachedInclude>([
      ['component:preview', { status: 'error', message: 'ECONNREFUSED' }]
    ])
    const out = presubstitute('[[include component:preview]]', {
      onlineFeatures: true,
      getCached: (path) => cache.get(path)
    })
    expect(out).not.toContain('ECONNREFUSED')
    expect(out).toContain('preview')
  })

  it('the bundle serves when online and no cache entry exists yet', () => {
    const out = presubstitute('[[include component:image-block name=cat.png]]', {
      onlineFeatures: true,
      getCached: () => undefined
    })
    expect(out).not.toContain('resolving')
    expect(out).toContain('cat.png')
  })

  it('leaves an unbundled path on the existing placeholder behavior', () => {
    const out = presubstitute('[[include component:classified]]', { onlineFeatures: false })
    expect(out).toContain('wd-fake-classified-bar')
  })

  it('does not match a bundled path under a different site prefix', () => {
    const out = presubstitute('[[include :some-other-wiki:component:license-box]]', {
      onlineFeatures: false
    })
    expect(out).toContain('wd-fake-license-box')
  })

  it('makes no browser-auto-loaded network reference regardless of the online-features toggle', () => {
    // A resource load (url()/@import/[[image]]/[[iframe]]/src="") bypasses the toggle
    // entirely, unlike a JS fetch — not scoped to inert prose citation links.
    const NETWORK_RESOURCE_REF =
      /(?:url\(\s*['"]?|@import\s+['"]?|\[\[image\s+|\[\[iframe\s+|src=['"])https?:\/\//i
    for (const { path } of BUNDLED_INCLUDE_META) {
      const source = getBundledInclude(path)?.source
      expect(source, `missing bundled source for ${path}`).toBeDefined()
      expect(source, `${path} has a resource reference pointing at the network`).not.toMatch(
        NETWORK_RESOURCE_REF
      )
    }
  })

  it('honors a caller-supplied width/align, falling back to the component default when omitted', () => {
    const withParams = presubstitute(
      '[[include component:image-block name=x.png|width=250px|align=left]]',
      { onlineFeatures: false }
    )
    expect(withParams).toContain('width:250px')
    expect(withParams).toContain('block-left')

    const withoutParams = presubstitute('[[include component:image-block name=x.png]]', {
      onlineFeatures: false
    })
    expect(withoutParams).toContain('width:300px')
    expect(withoutParams).toContain('block-right')
  })

  it('rejects a path extracted from an unstripped viewer-HTML anchor', () => {
    const paths = collectIncludePaths(
      '[[include <a href="http://scp-wiki.wikidot.com/component:license-box-backend">' +
        ':scp-wiki:component:license-box-backend</a>\n|author={$author}]]',
      () => undefined
    )
    expect(paths).toEqual([])
  })

  it('rejects a path extracted from inside an @@-escaped verbatim example block', () => {
    const paths = collectIncludePaths(
      '[[include :scp-wiki:component:license-box@@\n\n@@|author=Moto42]]',
      () => undefined
    )
    expect(paths).toEqual([])
  })

  it('collapses the bare and site-qualified spelling of the same path to one entry', () => {
    const paths = collectIncludePaths(
      '[[include component:foo]] [[include :scp-wiki:component:foo]]',
      () => undefined
    )
    expect(paths).toEqual(['component:foo'])
  })
})
