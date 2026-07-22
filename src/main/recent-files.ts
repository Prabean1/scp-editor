import { app } from 'electron'
import Store from 'electron-store'

const MAX_RECENT = 10

interface RecentFilesSchema {
  recentFiles: string[]
}

const store = new Store<RecentFilesSchema>({ defaults: { recentFiles: [] } })

export function getRecentFiles(): string[] {
  return store.get('recentFiles')
}

export function addRecentFile(filePath: string): void {
  const existing = store.get('recentFiles').filter((p) => p !== filePath)
  store.set('recentFiles', [filePath, ...existing].slice(0, MAX_RECENT))
  app.addRecentDocument(filePath)
}

export function removeRecentFile(filePath: string): void {
  store.set(
    'recentFiles',
    store.get('recentFiles').filter((p) => p !== filePath)
  )
}
