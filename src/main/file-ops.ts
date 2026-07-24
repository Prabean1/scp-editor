import { dialog, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { basename, extname } from 'path'

export interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

export interface Article {
  filePath: string
  source: string
  pageInfo: PageInfoInput
}

const WIKIDOT_FILTER = [{ name: 'Wikidot Articles', extensions: ['wikidot'] }]

function metaPathFor(filePath: string): string {
  return `${filePath}.meta.json`
}

export async function writeFileAtomic(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.writeFile(tmpPath, data, 'utf8')
    await fs.rename(tmpPath, filePath)
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {})
    throw err
  }
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
