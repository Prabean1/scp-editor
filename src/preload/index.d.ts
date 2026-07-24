interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

interface RenderResult {
  html: string
  errors: unknown[]
}

interface Article {
  filePath: string
  source: string
  pageInfo: PageInfoInput
}

interface AutosaveRecord {
  filePath: string | null
  source: string
  pageInfo: PageInfoInput
  savedAt: number
}

interface AutosaveInput {
  draftId: string
  filePath: string | null
  source: string
  pageInfo: PageInfoInput
}

interface OrphanAutosave {
  draftId: string
  record: AutosaveRecord
}

type SnapshotTrigger = 'save' | 'timer'

interface SnapshotRecord {
  filePath: string
  source: string
  pageInfo: PageInfoInput
  savedAt: number
  trigger: SnapshotTrigger
}

interface SnapshotInput {
  filePath: string
  source: string
  pageInfo: PageInfoInput
  trigger: SnapshotTrigger
}

interface SnapshotMeta {
  id: string
  savedAt: number
  trigger: SnapshotTrigger
}

interface Api {
  renderWikitext: (source: string, pageInfo?: PageInfoInput) => Promise<RenderResult>
  parseWikitext: (
    source: string,
    pageInfo?: PageInfoInput
  ) => Promise<{ ast: unknown; errors: unknown[] }>

  openFileDialog: () => Promise<Article | null>
  openFilePath: (filePath: string) => Promise<Article | null>
  saveFile: (filePath: string, source: string, pageInfo: PageInfoInput) => Promise<string>
  saveFileDialog: (
    source: string,
    pageInfo: PageInfoInput,
    suggestedName?: string
  ) => Promise<string | null>
  getRecentFiles: () => Promise<string[]>

  autosaveWrite: (input: AutosaveInput) => Promise<void>
  autosaveClear: (input: { draftId: string; filePath: string | null }) => Promise<void>
  autosaveCheckFile: (filePath: string) => Promise<AutosaveRecord | null>
  autosaveListOrphans: () => Promise<OrphanAutosave[]>
  autosaveConfirmRecovery: (label: string, record: AutosaveRecord) => Promise<'recover' | 'discard'>

  snapshotWrite: (input: SnapshotInput) => Promise<void>
  snapshotList: (filePath: string) => Promise<SnapshotMeta[]>
  snapshotRead: (filePath: string, id: string) => Promise<SnapshotRecord | null>

  setDirty: (dirty: boolean) => void
  confirmDiscard: () => Promise<'save' | 'discard' | 'cancel'>
  reportSaveBeforeCloseResult: (ok: boolean) => void

  onMenuNew: (callback: () => void) => () => void
  onMenuOpen: (callback: () => void) => () => void
  onMenuSave: (callback: () => void) => () => void
  onMenuSaveAs: (callback: () => void) => () => void
  onMenuOpenPath: (callback: (filePath: string) => void) => () => void
  onSaveBeforeClose: (callback: () => void) => () => void
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
