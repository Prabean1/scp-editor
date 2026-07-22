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

const api = {
  renderWikitext: (source: string, pageInfo?: PageInfoInput) =>
    ipcRenderer.invoke('ftml:render', source, pageInfo)
}

contextBridge.exposeInMainWorld('api', api)
