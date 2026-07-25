import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { writeFileAtomic } from './file-ops'

// Flat, content-addressed blob store: images live at images/<id>, id =
// <8-hex ownerHash><8-hex contentHash>.<ext>. Both hashes are baked into
// the id, so downstream code (presubstitute rewrite, resource:// handler)
// never needs to know which article an id belongs to — it's a plain string
// lookup. "Owner" is a saved article's file path or an unsaved draft's id
// (same draftId autosave.ts uses), so a dropped image previews before the
// article is saved.

export type ImageOwner = { kind: 'file'; filePath: string } | { kind: 'draft'; draftId: string }

export interface ImageManifestEntry {
  id: string
  ownerKind: 'file' | 'draft'
  ownerRaw: string
  originalName: string
  addedAt: number
}

export interface SavedImage {
  id: string
  originalName: string
}

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
export const IMAGE_ID_RE = /^[a-f0-9]{16}\.(png|jpe?g|gif|webp)$/

function imagesRoot(): string {
  return join(app.getPath('userData'), 'images')
}

function manifestPath(): string {
  return join(imagesRoot(), 'manifest.json')
}

function ownerString(owner: ImageOwner): string {
  return owner.kind === 'file' ? `file:${owner.filePath}` : `draft:${owner.draftId}`
}

function hashHex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8)
}

function extensionFor(filename: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(filename)
  if (!match) return null
  const ext = match[1].toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : null
}

async function readManifest(): Promise<ImageManifestEntry[]> {
  try {
    const raw = await fs.readFile(manifestPath(), 'utf8')
    return JSON.parse(raw) as ImageManifestEntry[]
  } catch {
    return []
  }
}

async function writeManifest(entries: ImageManifestEntry[]): Promise<void> {
  await writeFileAtomic(manifestPath(), JSON.stringify(entries, null, 2))
}

export async function saveImage(input: {
  owner: ImageOwner
  filename: string
  bytes: Buffer
}): Promise<SavedImage | null> {
  const ext = extensionFor(input.filename)
  if (!ext) return null

  await fs.mkdir(imagesRoot(), { recursive: true })
  const id = `${hashHex(ownerString(input.owner))}${hashHex(input.bytes)}.${ext}`
  const filePath = join(imagesRoot(), id)
  const exists = await fs
    .stat(filePath)
    .then(() => true)
    .catch(() => false)
  if (!exists) {
    await writeFileAtomic(filePath, input.bytes)
  }

  const manifest = await readManifest()
  if (!manifest.some((entry) => entry.id === id)) {
    manifest.push({
      id,
      ownerKind: input.owner.kind,
      ownerRaw: input.owner.kind === 'file' ? input.owner.filePath : input.owner.draftId,
      originalName: input.filename,
      addedAt: Date.now()
    })
    await writeManifest(manifest)
  }
  return { id, originalName: input.filename }
}

export async function listImagesForOwner(owner: ImageOwner): Promise<ImageManifestEntry[]> {
  const manifest = await readManifest()
  const raw = owner.kind === 'file' ? owner.filePath : owner.draftId
  return manifest.filter((entry) => entry.ownerKind === owner.kind && entry.ownerRaw === raw)
}

export async function resolveImageNames(ids: string[]): Promise<Record<string, string>> {
  const manifest = await readManifest()
  const byId = new Map(manifest.map((entry) => [entry.id, entry.originalName]))
  const result: Record<string, string> = {}
  for (const id of ids) {
    const name = byId.get(id)
    if (name) result[id] = name
  }
  return result
}

export async function adoptDraftImages(draftId: string, filePath: string): Promise<void> {
  const manifest = await readManifest()
  let changed = false
  for (const entry of manifest) {
    if (entry.ownerKind === 'draft' && entry.ownerRaw === draftId) {
      entry.ownerKind = 'file'
      entry.ownerRaw = filePath
      changed = true
    }
  }
  if (changed) await writeManifest(manifest)
}

async function deleteImagesForOwner(ownerKind: 'file' | 'draft', ownerRaw: string): Promise<void> {
  const manifest = await readManifest()
  const [toDelete, toKeep] = [
    manifest.filter((e) => e.ownerKind === ownerKind && e.ownerRaw === ownerRaw),
    manifest.filter((e) => !(e.ownerKind === ownerKind && e.ownerRaw === ownerRaw))
  ]
  await Promise.all(
    toDelete.map((entry) => fs.unlink(join(imagesRoot(), entry.id)).catch(() => {}))
  )
  await writeManifest(toKeep)
}

export async function clearDraftImages(draftId: string): Promise<void> {
  await deleteImagesForOwner('draft', draftId)
}

export interface OrphanImageOwner {
  filePath: string
  entries: ImageManifestEntry[]
}

export async function listOrphanImageOwners(): Promise<OrphanImageOwner[]> {
  const manifest = await readManifest()
  const byPath = new Map<string, ImageManifestEntry[]>()
  for (const entry of manifest) {
    if (entry.ownerKind !== 'file') continue
    const list = byPath.get(entry.ownerRaw) ?? []
    list.push(entry)
    byPath.set(entry.ownerRaw, list)
  }
  const orphans: OrphanImageOwner[] = []
  for (const [filePath, entries] of byPath) {
    const exists = await fs
      .stat(filePath)
      .then(() => true)
      .catch(() => false)
    if (!exists) orphans.push({ filePath, entries })
  }
  return orphans
}

export async function deleteOrphanImageOwner(filePath: string): Promise<void> {
  await deleteImagesForOwner('file', filePath)
}

export function imageFilePath(id: string): string {
  return join(imagesRoot(), id)
}
