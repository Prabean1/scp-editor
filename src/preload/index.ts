import { contextBridge, ipcRenderer } from 'electron'

// sandbox: true means require() only works for Electron's own built-ins;
// @electron-toolkit/preload failed silently this way once (no error, window.api just never appeared).

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

type ImageOwner = { kind: 'file'; filePath: string } | { kind: 'draft'; draftId: string }

interface ImageManifestEntry {
  id: string
  ownerKind: 'file' | 'draft'
  ownerRaw: string
  originalName: string
  addedAt: number
}

interface SavedImage {
  id: string
  originalName: string
}

interface OrphanImageOwner {
  filePath: string
  entries: ImageManifestEntry[]
}

function subscribe(channel: string, callback: (...args: unknown[]) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
    callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  renderWikitext: (source: string, pageInfo?: PageInfoInput) =>
    ipcRenderer.invoke('ftml:render', source, pageInfo),
  parseWikitext: (source: string, pageInfo?: PageInfoInput) =>
    ipcRenderer.invoke('ftml:parse', source, pageInfo),

  openFileDialog: (): Promise<Article | null> => ipcRenderer.invoke('file:open-dialog'),
  openFilePath: (filePath: string): Promise<Article | null> =>
    ipcRenderer.invoke('file:open-path', filePath),
  saveFile: (filePath: string, source: string, pageInfo: PageInfoInput): Promise<string> =>
    ipcRenderer.invoke('file:save', filePath, source, pageInfo),
  saveFileDialog: (
    source: string,
    pageInfo: PageInfoInput,
    suggestedName?: string
  ): Promise<string | null> =>
    ipcRenderer.invoke('file:save-dialog', source, pageInfo, suggestedName),
  getRecentFiles: (): Promise<string[]> => ipcRenderer.invoke('file:get-recent'),

  autosaveWrite: (input: AutosaveInput): Promise<void> =>
    ipcRenderer.invoke('autosave:write', input),
  autosaveClear: (input: { draftId: string; filePath: string | null }): Promise<void> =>
    ipcRenderer.invoke('autosave:clear', input),
  autosaveCheckFile: (filePath: string): Promise<AutosaveRecord | null> =>
    ipcRenderer.invoke('autosave:check-file', filePath),
  autosaveListOrphans: (): Promise<OrphanAutosave[]> => ipcRenderer.invoke('autosave:list-orphans'),
  autosaveConfirmRecovery: (
    label: string,
    record: AutosaveRecord
  ): Promise<'recover' | 'discard'> =>
    ipcRenderer.invoke('autosave:confirm-recovery', label, record),

  snapshotWrite: (input: SnapshotInput): Promise<void> =>
    ipcRenderer.invoke('snapshot:write', input),
  snapshotList: (filePath: string): Promise<SnapshotMeta[]> =>
    ipcRenderer.invoke('snapshot:list', filePath),
  snapshotRead: (filePath: string, id: string): Promise<SnapshotRecord | null> =>
    ipcRenderer.invoke('snapshot:read', filePath, id),

  imageSave: (owner: ImageOwner, filename: string, bytes: Uint8Array): Promise<SavedImage | null> =>
    ipcRenderer.invoke('image:save', owner, filename, bytes),
  imageList: (owner: ImageOwner): Promise<ImageManifestEntry[]> =>
    ipcRenderer.invoke('image:list', owner),
  imageResolveNames: (ids: string[]): Promise<Record<string, string>> =>
    ipcRenderer.invoke('image:resolve-names', ids),
  imageAdoptDraft: (draftId: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke('image:adopt-draft', draftId, filePath),
  imageClearDraft: (draftId: string): Promise<void> =>
    ipcRenderer.invoke('image:clear-draft', draftId),
  imageListOrphans: (): Promise<OrphanImageOwner[]> => ipcRenderer.invoke('image:list-orphans'),
  imageDeleteOrphan: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('image:delete-orphan', filePath),
  imageConfirmCleanup: (filePath: string, imageCount: number): Promise<'delete' | 'keep'> =>
    ipcRenderer.invoke('image:confirm-cleanup', filePath, imageCount),

  clipboardWriteText: (text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:write-text', text),
  exportConfirmLocalImages: (names: string[]): Promise<'copy' | 'cancel'> =>
    ipcRenderer.invoke('export:confirm-local-images', names),

  setDirty: (dirty: boolean): void => ipcRenderer.send('app:set-dirty', dirty),
  confirmDiscard: (): Promise<'save' | 'discard' | 'cancel'> =>
    ipcRenderer.invoke('dialog:confirm-discard'),
  reportSaveBeforeCloseResult: (ok: boolean): void =>
    ipcRenderer.send('app:save-before-close-result', ok),

  onMenuNew: (callback: () => void) => subscribe('menu:new', callback),
  onMenuOpen: (callback: () => void) => subscribe('menu:open', callback),
  onMenuSave: (callback: () => void) => subscribe('menu:save', callback),
  onMenuSaveAs: (callback: () => void) => subscribe('menu:save-as', callback),
  onMenuOpenPath: (callback: (filePath: string) => void) =>
    subscribe('menu:open-path', callback as (...args: unknown[]) => void),
  onSaveBeforeClose: (callback: () => void) => subscribe('app:save-before-close', callback)
}

contextBridge.exposeInMainWorld('api', api)
