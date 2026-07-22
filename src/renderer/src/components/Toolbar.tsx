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
}

const MODES: Mode[] = ['edit', 'split', 'preview']

export default function Toolbar({
  fileButtons,
  buttons,
  mode,
  onModeChange
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
    </div>
  )
}
