import { contextBridge, ipcRenderer } from 'electron'

// NOTE: sandbox: true means this preload can only use Electron's own
// built-ins (contextBridge, ipcRenderer, process) — require()'ing anything
// from node_modules (e.g. @electron-toolkit/preload) fails at runtime with
// "module not found" because sandboxed preload scripts don't get Node's
// normal module resolution. Confirmed empirically: window.api never got
// exposed and the renderer saw "Cannot read properties of undefined".

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
