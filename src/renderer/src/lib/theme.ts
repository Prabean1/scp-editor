import { boolCodec, enumCodec, numberCodec, rangeCodec } from './usePersistedSetting'

export type Theme = 'docs' | 'scp'
export type EditorStyle = 'code' | 'paper'
export type AutosaveIntervalSeconds = 30 | 60 | 120

export const MIN_SPLIT = 0.15
export const MAX_SPLIT = 0.85

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export const themeSetting = {
  key: 'scp-editor-theme',
  codec: enumCodec<Theme>(['docs', 'scp'], 'docs')
}

export const editorStyleSetting = {
  key: 'scp-editor-pane-style',
  codec: enumCodec<EditorStyle>(['code', 'paper'], 'code')
}

export const splitSetting = {
  key: 'scp-editor-split',
  codec: rangeCodec(MIN_SPLIT, MAX_SPLIT, 0.5)
}

export const autosaveIntervalSetting = {
  key: 'scp-editor-autosave-interval',
  codec: numberCodec<AutosaveIntervalSeconds>([30, 60, 120], 60)
}

export const autoCloseSetting = {
  key: 'scp-editor-autoclose',
  codec: boolCodec(true)
}

export const lintUnclosedTagsSetting = {
  key: 'scp-editor-lint-unclosed',
  codec: boolCodec(true)
}

// Defaults OFF unlike its sibling toggles — it mutates characters saved to
// disk, not just editor assist chrome, so it's opt-in.
export const smartQuotesSetting = {
  key: 'scp-editor-smart-quotes',
  codec: boolCodec(false)
}

// Read before React mounts (see main.tsx), so it can't go through the
// usePersistedSetting hook — everything else does.
export function getStoredTheme(): Theme {
  return themeSetting.codec.decode(localStorage.getItem(themeSetting.key))
}
