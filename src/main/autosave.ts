import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { writeFileAtomic, type PageInfoInput } from './file-ops'

export interface AutosaveRecord {
  filePath: string | null
  source: string
  pageInfo: PageInfoInput
  savedAt: number
}

export interface AutosaveInput {
  draftId: string
  filePath: string | null
  source: string
  pageInfo: PageInfoInput
}

export interface OrphanAutosave {
  draftId: string
  record: AutosaveRecord
}

function autosaveDir(): string {
  return join(app.getPath('userData'), 'autosave')
}

function hashKey(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex')
}

function recordPath(key: string): string {
  return join(autosaveDir(), `${key}.json`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(autosaveDir(), { recursive: true })
}

export async function writeAutosave(input: AutosaveInput): Promise<void> {
  await ensureDir()
  const record: AutosaveRecord = {
    filePath: input.filePath,
    source: input.source,
    pageInfo: input.pageInfo,
    savedAt: Date.now()
  }
  const key = input.filePath ? hashKey(input.filePath) : input.draftId
  await writeFileAtomic(recordPath(key), JSON.stringify(record))
}

export async function clearAutosave(input: {
  draftId: string
  filePath: string | null
}): Promise<void> {
  const keys = input.filePath ? [hashKey(input.filePath), input.draftId] : [input.draftId]
  await Promise.all(keys.map((key) => fs.unlink(recordPath(key)).catch(() => {})))
}

export async function checkFileAutosave(filePath: string): Promise<AutosaveRecord | null> {
  try {
    const [raw, stat] = await Promise.all([
      fs.readFile(recordPath(hashKey(filePath)), 'utf8'),
      fs.stat(filePath)
    ])
    const record = JSON.parse(raw) as AutosaveRecord
    return record.savedAt > stat.mtimeMs ? record : null
  } catch {
    return null
  }
}

export async function listOrphanAutosaves(): Promise<OrphanAutosave[]> {
  await ensureDir()
  const files = await fs.readdir(autosaveDir())
  const orphans: OrphanAutosave[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(join(autosaveDir(), file), 'utf8')
      const record = JSON.parse(raw) as AutosaveRecord
      if (record.filePath === null) {
        orphans.push({ draftId: file.slice(0, -'.json'.length), record })
      }
    } catch {
      // Corrupted/partially-written record — skip it.
    }
  }
  orphans.sort((a, b) => b.record.savedAt - a.record.savedAt)
  return orphans
}
