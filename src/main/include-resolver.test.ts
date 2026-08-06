import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const userDataDir = mkdtempSync(join(tmpdir(), 'scp-editor-test-'))

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, isPackaged: false }
}))

const { resolveInclude } = await import('./include-resolver')
const { setOnlineFeaturesEnabled } = await import('./online-features')

describe('resolveInclude egress boundary', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    fetchSpy.mockClear()
    setOnlineFeaturesEnabled(true)
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('rejects a non-canonical path (path/query/fragment riding through the URL) without fetching', async () => {
    const result = await resolveInclude(':scp-wiki:foo/../bar?x=1')
    expect(result).toEqual({ status: 'error', message: 'invalid include path' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a query string on an otherwise-bare path without fetching', async () => {
    const result = await resolveInclude('foo?x=1')
    expect(result).toEqual({ status: 'error', message: 'invalid include path' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refuses to fetch when online features are disabled', async () => {
    setOnlineFeaturesEnabled(false)
    const result = await resolveInclude('component:some-page')
    expect(result).toEqual({ status: 'error', message: 'online features are disabled' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
