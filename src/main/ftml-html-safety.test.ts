import { describe, expect, it, vi } from 'vitest'

// ftml-bridge.ts reads app.isPackaged to locate the wasm pkg — outside a
// real Electron process that import has no `app`, so stub just enough.
vi.mock('electron', () => ({ app: { isPackaged: false } }))

const { renderWikitext } = await import('./ftml-bridge')

// Does ftml ever emit unescaped author-controlled HTML into the privileged
// renderer (RawBlockView.tsx's dangerouslySetInnerHTML)?
describe('ftml html output stays safe for a privileged sink', () => {
  it('[[html]] does not inject the raw HTML — post_html is a stub', () => {
    const { html } = renderWikitext('[[html]]\n<script>alert(1)</script>\n[[/html]]')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html.toLowerCase()).not.toContain('<script')
  })

  it('[[iframe]] with a javascript: url is rejected as malformed, not rendered live', () => {
    const { html } = renderWikitext('[[iframe javascript:alert(1)]]')
    expect(html.toLowerCase()).not.toContain('src="javascript:')
  })

  it('on* attributes are dropped by the attribute allowlist', () => {
    const { html } = renderWikitext('[[span onclick="alert(1)" style="color: red"]]x[[/span]]')
    expect(html.toLowerCase()).not.toContain('onclick')
    expect(html).toContain('color: red')
  })

  it('a javascript: link scheme never reaches an href', () => {
    const { html } = renderWikitext('[javascript:alert(1) XSS]')
    expect(html.toLowerCase()).not.toContain('href="javascript:')
  })

  it('[[embed youtube]] always uses the hardcoded youtube iframe template', () => {
    const { html } = renderWikitext('[[embed youtube video="dQw4w9WgXcQ"]]')
    expect(html).toContain('src="https://www.youtube.com/embed/dQw4w9WgXcQ"')
  })
})
