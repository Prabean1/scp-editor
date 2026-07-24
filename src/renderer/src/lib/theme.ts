export type Theme = 'docs' | 'scp'

const STORAGE_KEY = 'scp-editor-theme'
const DEFAULT_THEME: Theme = 'docs'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'docs' || stored === 'scp' ? stored : DEFAULT_THEME
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export type EditorStyle = 'code' | 'paper'

const EDITOR_STYLE_KEY = 'scp-editor-pane-style'
const DEFAULT_EDITOR_STYLE: EditorStyle = 'code'

export function getStoredEditorStyle(): EditorStyle {
  const stored = localStorage.getItem(EDITOR_STYLE_KEY)
  return stored === 'code' || stored === 'paper' ? stored : DEFAULT_EDITOR_STYLE
}

export function setEditorStyle(style: EditorStyle): void {
  localStorage.setItem(EDITOR_STYLE_KEY, style)
}

const SPLIT_KEY = 'scp-editor-split'
const DEFAULT_SPLIT = 0.5
export const MIN_SPLIT = 0.15
export const MAX_SPLIT = 0.85

export function getStoredSplit(): number {
  const stored = Number(localStorage.getItem(SPLIT_KEY))
  return stored >= MIN_SPLIT && stored <= MAX_SPLIT ? stored : DEFAULT_SPLIT
}

export function setSplit(fraction: number): void {
  localStorage.setItem(SPLIT_KEY, String(fraction))
}

export type AutosaveIntervalSeconds = 30 | 60 | 120

const AUTOSAVE_INTERVAL_KEY = 'scp-editor-autosave-interval'
const DEFAULT_AUTOSAVE_INTERVAL: AutosaveIntervalSeconds = 60

export function getStoredAutosaveInterval(): AutosaveIntervalSeconds {
  const stored = Number(localStorage.getItem(AUTOSAVE_INTERVAL_KEY))
  return stored === 30 || stored === 60 || stored === 120 ? stored : DEFAULT_AUTOSAVE_INTERVAL
}

export function setAutosaveInterval(seconds: AutosaveIntervalSeconds): void {
  localStorage.setItem(AUTOSAVE_INTERVAL_KEY, String(seconds))
}

const AUTOCLOSE_KEY = 'scp-editor-autoclose'

export function getStoredAutoClose(): boolean {
  return localStorage.getItem(AUTOCLOSE_KEY) !== 'off'
}

export function setAutoClose(on: boolean): void {
  localStorage.setItem(AUTOCLOSE_KEY, on ? 'on' : 'off')
}
