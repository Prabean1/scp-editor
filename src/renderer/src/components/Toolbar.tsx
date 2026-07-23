import type { Theme } from '../lib/theme'

export type Mode = 'edit' | 'split' | 'preview'

export interface ToolbarButton {
  label: string
  title: string
  action: () => void
}

interface ToolbarProps {
  fileButtons: ToolbarButton[]
  buttons: ToolbarButton[]
  mode: Mode
  onModeChange: (mode: Mode) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

const MODES: Mode[] = ['edit', 'split', 'preview']

const THEMES: { value: Theme; label: string }[] = [
  { value: 'docs', label: 'Docs Light' },
  { value: 'scp', label: 'SCP Dark' }
]

export default function Toolbar({
  fileButtons,
  buttons,
  mode,
  onModeChange,
  theme,
  onThemeChange
}: ToolbarProps): React.JSX.Element {
  return (
    <div className="toolbar">
      <strong className="toolbar-title">SCP Doc Editor</strong>
      <div className="toolbar-file-buttons">
        {fileButtons.map((b) => (
          <button key={b.label} title={b.title} onClick={b.action}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="toolbar-buttons">
        {buttons.map((b) => (
          <button key={b.label} title={b.title} onClick={b.action}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="toolbar-modes">
        {MODES.map((m) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => onModeChange(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="toolbar-theme">
        <select
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as Theme)}
          title="Theme"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
