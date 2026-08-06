import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Main is the single source of truth — the renderer can request the flag on
// (through the consent dialog) or off, but never flips it itself.
function storePath(): string {
  return join(app.getPath('userData'), 'online-features.json')
}

function load(): boolean {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), 'utf8'))
    return parsed === true
  } catch {
    return false
  }
}

export function isOnlineFeaturesEnabled(): boolean {
  return load()
}

export function setOnlineFeaturesEnabled(enabled: boolean): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(storePath(), JSON.stringify(enabled))
}
