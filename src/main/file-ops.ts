import { dialog, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { randomUUID } from 'crypto'
import type { Article, PageInfoInput } from '../shared/types'

export type { Article, PageInfoInput }

const WIKIDOT_FILTER = [{ name: 'Wikidot Articles', extensions: ['wikidot'] }]

function metaPathFor(filePath: string): string {
  return `${filePath}.meta.json`
}

async function writeThenRename(filePath: string, data: string | Buffer): Promise<void> {
  const tmpPath = `${filePath}.${randomUUID()}.tmp`
  try {
    if (typeof data === 'string') {
      await fs.writeFile(tmpPath, data, 'utf8')
    } else {
      await fs.writeFile(tmpPath, data)
    }
    await fs.rename(tmpPath, filePath)
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {})
    throw err
  }
}

const writeQueues = new Map<string, Promise<void>>()

// Windows fails a replacing rename with EPERM when two land on one destination
// at once. Arrival order wins — see ensureDir in autosave.ts.
export function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve()
  const write = previous.then(() => writeThenRename(filePath, data))
  // The queued copy swallows failures so one bad write can't poison the chain
  // or surface as an unhandled rejection — the caller still gets the real one.
  const queued = write.catch(() => {})
  writeQueues.set(filePath, queued)
  queued.then(() => {
    if (writeQueues.get(filePath) === queued) writeQueues.delete(filePath)
  })
  return write
}

export function defaultPageInfoFor(filePath: string): PageInfoInput {
  const stem = basename(filePath, extname(filePath))
  return {
    page: stem,
    category: null,
    site: 'scp-wiki',
    title: stem,
    alt_title: null,
    score: 0,
    tags: [],
    language: 'en'
  }
}

export async function readArticle(filePath: string): Promise<Article> {
  const source = await fs.readFile(filePath, 'utf8')
  let pageInfo = defaultPageInfoFor(filePath)
  try {
    const metaRaw = await fs.readFile(metaPathFor(filePath), 'utf8')
    pageInfo = { ...pageInfo, ...JSON.parse(metaRaw) }
  } catch {
    // No sidecar, or it's invalid — fall back to filename-derived defaults.
  }
  return { filePath, source, pageInfo }
}

export async function writeArticle(
  filePath: string,
  source: string,
  pageInfo: PageInfoInput
): Promise<void> {
  await writeFileAtomic(filePath, source)
  await writeFileAtomic(metaPathFor(filePath), JSON.stringify(pageInfo, null, 2))
}

export async function showOpenDialog(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: WIKIDOT_FILTER
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function showSaveDialog(
  win: BrowserWindow,
  defaultPath?: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(win, {
    defaultPath,
    filters: WIKIDOT_FILTER
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
}
