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
