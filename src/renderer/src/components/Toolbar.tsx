import {
  Code,
  Columns2,
  Eye,
  FileText,
  Moon,
  PencilLine,
  Sun,
  Wand2,
  type LucideIcon
} from 'lucide-react'
import type { EditorStyle, Theme } from '../lib/theme'

export type Mode = 'edit' | 'split' | 'preview' | 'wysiwyg'

export interface ToolbarButton {
  label: string
  title: string
  action: () => void
  icon: LucideIcon
}

interface ToolbarProps {
  fileButtons: ToolbarButton[]
  buttons: ToolbarButton[]
  mode: Mode
  onModeChange: (mode: Mode) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  editorStyle: EditorStyle
  onEditorStyleChange: (style: EditorStyle) => void
}

const MODES: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: 'edit', label: 'Edit', icon: PencilLine },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'preview', label: 'Preview', icon: Eye },
  { value: 'wysiwyg', label: 'WYSIWYG', icon: Wand2 }
]

export default function Toolbar({
  fileButtons,
  buttons,
  mode,
  onModeChange,
  theme,
  onThemeChange,
  editorStyle,
  onEditorStyleChange
}: ToolbarProps): React.JSX.Element {
  const isDark = theme === 'scp'
  const isPaper = editorStyle === 'paper'

  return (
    <div className="toolbar">
      <strong className="toolbar-title">SCP Doc Editor</strong>
      <div className="toolbar-file-buttons">
        {fileButtons.map((b) => {
          const Icon = b.icon
          return (
            <button key={b.label} title={b.title} aria-label={b.label} onClick={b.action}>
              <Icon size={16} aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <div className="toolbar-buttons">
        {buttons.map((b) => {
          const Icon = b.icon
          return (
            <button
              key={b.label}
              title={b.title}
              aria-label={b.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={b.action}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <div className="toolbar-modes">
        {MODES.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.value}
              className={mode === m.value ? 'active' : ''}
              onClick={() => onModeChange(m.value)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{m.label}</span>
            </button>
          )
        })}
      </div>
      <div className="toolbar-theme">
        <button
          className="toolbar-editor-toggle"
          title={isPaper ? 'Switch to code editor style' : 'Switch to paper editor style'}
          aria-label={isPaper ? 'Switch to code editor style' : 'Switch to paper editor style'}
          onClick={() => onEditorStyleChange(isPaper ? 'code' : 'paper')}
        >
          {isPaper ? (
            <Code size={16} aria-hidden="true" />
          ) : (
            <FileText size={16} aria-hidden="true" />
          )}
        </button>
        <button
          className="toolbar-theme-toggle"
          title={isDark ? 'Switch to Docs Light theme' : 'Switch to SCP Dark theme'}
          aria-label={isDark ? 'Switch to Docs Light theme' : 'Switch to SCP Dark theme'}
          onClick={() => onThemeChange(isDark ? 'docs' : 'scp')}
        >
          {isDark ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
