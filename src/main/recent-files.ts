import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const MAX_RECENT = 10

function storePath(): string {
  return join(app.getPath('userData'), 'recent-files.json')
}

function load(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(files: string[]): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(storePath(), JSON.stringify(files))
}

export function getRecentFiles(): string[] {
  return load()
}

export function addRecentFile(filePath: string): void {
  const existing = load().filter((p) => p !== filePath)
  save([filePath, ...existing].slice(0, MAX_RECENT))
  app.addRecentDocument(filePath)
}

export function removeRecentFile(filePath: string): void {
  save(load().filter((p) => p !== filePath))
}
