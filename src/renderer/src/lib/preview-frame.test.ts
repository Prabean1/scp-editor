import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FRAME_SCRIPT } from './preview-frame'

// The hash source is the only thing that lets FRAME_SCRIPT run under index.html's CSP —
// an edit here without updating that hash fails loudly instead of silently breaking the frame.
describe('FRAME_SCRIPT CSP hash', () => {
  it('is allow-listed in index.html', () => {
    const hash = createHash('sha256').update(FRAME_SCRIPT, 'utf8').digest('base64')
    const indexHtmlPath = fileURLToPath(new URL('../../index.html', import.meta.url))
    const indexHtml = readFileSync(indexHtmlPath, 'utf8')
    expect(indexHtml).toContain(`'sha256-${hash}'`)
  })
})
