import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { writeFileAtomic, type PageInfoInput } from './file-ops'

export type SnapshotTrigger = 'save' | 'timer'

export interface SnapshotRecord {
  filePath: string
  source: string
  pageInfo: PageInfoInput
  savedAt: number
  trigger: SnapshotTrigger
}

export interface SnapshotInput {
  filePath: string
  source: string
  pageInfo: PageInfoInput
  trigger: SnapshotTrigger
}

export interface SnapshotMeta {
  id: string
  savedAt: number
  trigger: SnapshotTrigger
}

const MAX_SNAPSHOTS = 20

function snapshotsRoot(): string {
  return join(app.getPath('userData'), 'snapshots')
}

function hashKey(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex')
}

function snapshotDirFor(filePath: string): string {
  return join(snapshotsRoot(), hashKey(filePath))
}

function snapshotPath(filePath: string, id: string): string {
  return join(snapshotDirFor(filePath), `${id}.json`)
}

async function ensureDir(filePath: string): Promise<string> {
  const dir = snapshotDirFor(filePath)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

async function listIds(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir).catch(() => [])
  return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length))
}

export async function writeSnapshot(input: SnapshotInput): Promise<void> {
  const dir = await ensureDir(input.filePath)
  const ids = (await listIds(dir)).sort().reverse()

  if (ids.length > 0) {
    const latestRaw = await fs.readFile(join(dir, `${ids[0]}.json`), 'utf8').catch(() => null)
    if (latestRaw) {
      const latest = JSON.parse(latestRaw) as SnapshotRecord
      if (
        latest.source === input.source &&
        JSON.stringify(latest.pageInfo) === JSON.stringify(input.pageInfo)
      ) {
        return
      }
    }
  }

  const savedAt = Date.now()
  const record: SnapshotRecord = {
    filePath: input.filePath,
    source: input.source,
    pageInfo: input.pageInfo,
    savedAt,
    trigger: input.trigger
  }
  await writeFileAtomic(snapshotPath(input.filePath, String(savedAt)), JSON.stringify(record))

  const allIds = [String(savedAt), ...ids].sort().reverse()
  const stale = allIds.slice(MAX_SNAPSHOTS)
  await Promise.all(stale.map((id) => fs.unlink(join(dir, `${id}.json`)).catch(() => {})))
}

export async function listSnapshots(filePath: string): Promise<SnapshotMeta[]> {
  const dir = snapshotDirFor(filePath)
  const ids = await listIds(dir)
  const metas: SnapshotMeta[] = []
  for (const id of ids) {
    const raw = await fs.readFile(join(dir, `${id}.json`), 'utf8').catch(() => null)
    if (!raw) continue
    try {
      const record = JSON.parse(raw) as SnapshotRecord
      metas.push({ id, savedAt: record.savedAt, trigger: record.trigger })
    } catch {
      // Corrupted/partially-written record — skip it.
    }
  }
  metas.sort((a, b) => b.savedAt - a.savedAt)
  return metas
}

export async function readSnapshot(filePath: string, id: string): Promise<SnapshotRecord | null> {
  try {
    const raw = await fs.readFile(snapshotPath(filePath, id), 'utf8')
    return JSON.parse(raw) as SnapshotRecord
  } catch {
    return null
  }
}
