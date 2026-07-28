// IPC payload shapes shared verbatim across main, preload, and renderer.
// Type-only — no runtime import, so it's exempt from preload's sandboxed require() restriction.

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

export interface RenderResult {
  html: string
  errors: unknown[]
}

export interface FtmlToken {
  token: string
  slice: string
  span: { start: number; end: number }
}

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

export interface OrphanImageOwner {
  filePath: string
  entries: ImageManifestEntry[]
}
