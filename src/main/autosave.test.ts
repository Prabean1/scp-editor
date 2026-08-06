import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const userDataDir = mkdtempSync(join(tmpdir(), 'scp-editor-autosave-test-'))

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, isPackaged: false }
}))

const { writeAutosave } = await import('./autosave')

afterAll(() => rmSync(userDataDir, { recursive: true, force: true }))

const input = (source: string): Parameters<typeof writeAutosave>[0] => ({
  draftId: 'draft-1',
  filePath: null,
  source,
  pageInfo: {
    page: 'untitled',
    category: null,
    site: 'scp-wiki',
    title: 'Untitled',
    alt_title: null,
    score: 0,
    tags: [],
    language: 'en'
  }
})

// Overlapping ticks reached writeFileAtomic concurrently: the pid+ms temp path
// collided outright, and Windows then failed the replacing rename with EPERM.
describe('concurrent autosave writes', () => {
  it('does not reject when several land on the same record at once', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, (_, i) => writeAutosave(input(`body ${i}`)))
    )
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected.map((r) => String((r as PromiseRejectedResult).reason))).toEqual([])
  })

  it('leaves the last write issued on disk, not whichever finished last', async () => {
    await Promise.all(Array.from({ length: 40 }, (_, i) => writeAutosave(input(`body ${i}`))))
    const record = JSON.parse(
      readFileSync(join(userDataDir, 'autosave', 'draft-1.json'), 'utf8')
    ) as { source: string }
    expect(record.source).toBe('body 39')
  })

  it('leaves no temp files behind', async () => {
    await Promise.all(Array.from({ length: 40 }, (_, i) => writeAutosave(input(`body ${i}`))))
    const left = readdirSync(join(userDataDir, 'autosave')).filter((f) => f.endsWith('.tmp'))
    expect(left).toEqual([])
  })
})
