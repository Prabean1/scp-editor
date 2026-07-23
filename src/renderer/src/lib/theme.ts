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
