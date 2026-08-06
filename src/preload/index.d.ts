import type {
  Article,
  AutosaveInput,
  AutosaveRecord,
  FtmlToken,
  ImageOwner,
  IncludeResolution,
  OrphanAutosave,
  OrphanImageOwner,
  PageInfoInput,
  RenderResult,
  SavedImage,
  SnapshotInput,
  SnapshotMeta,
  SnapshotRecord
} from '../shared/types'

interface Api {
  renderWikitext: (source: string, pageInfo?: PageInfoInput) => Promise<RenderResult>
  parseWikitext: (
    source: string,
    pageInfo?: PageInfoInput
  ) => Promise<{ ast: unknown; errors: unknown[] }>
  tokenizeWikitext: (source: string) => Promise<{ tokens: FtmlToken[] }>

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

  imageSave: (owner: ImageOwner, filename: string, bytes: Uint8Array) => Promise<SavedImage | null>
  imageResolveNames: (ids: string[]) => Promise<Record<string, string>>
  imageAdoptDraft: (draftId: string, filePath: string) => Promise<void>
  imageClearDraft: (draftId: string) => Promise<void>
  imageListOrphans: () => Promise<OrphanImageOwner[]>
  imageDeleteOrphan: (filePath: string) => Promise<void>
  imageConfirmCleanup: (filePath: string, imageCount: number) => Promise<'delete' | 'keep'>

  resolveInclude: (path: string) => Promise<IncludeResolution>
  refreshInclude: (path: string) => Promise<IncludeResolution>
  confirmOnlineFeatures: () => Promise<'enable' | 'cancel'>
  getOnlineFeatures: () => Promise<boolean>
  disableOnlineFeatures: () => void

  clipboardWriteText: (text: string) => Promise<void>
  exportConfirmLocalImages: (names: string[]) => Promise<'copy' | 'cancel'>

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
