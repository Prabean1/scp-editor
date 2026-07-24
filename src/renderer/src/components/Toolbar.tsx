import { useState, type ComponentType } from 'react'
import {
  AlignCenter,
  AlignLeft,
  Code,
  Download,
  FileText,
  History,
  MessageSquare,
  Moon,
  Redo2,
  Sun,
  Undo2
} from 'lucide-react'
import type { AutosaveIntervalSeconds, EditorStyle, Theme } from '../lib/theme'
import { MODES, type Mode } from '../lib/modes'

export type { Mode }

export interface ToolbarButton {
  label: string
  title: string
  action: () => void
  // Lucide icons satisfy this, but so does a plain glyph component (see
  // App.tsx's redaction button, which renders the literal "█" character
  // as its icon instead of an SVG).
  icon: ComponentType<{ size?: number }>
  // false marks a button whose syntax has no Rich Text mode destination
  // (RichTextEditor.tsx's MARK_COMMANDS has no entry for it) — greyed out
  // and disabled instead of silently no-op'ing when mode === 'richtext'.
  // Omitted/true means the button works in every mode.
  richTextSupported?: boolean
}

type RibbonTab = 'home' | 'insert'

interface ToolbarProps {
  fileButtons: ToolbarButton[]
  homeButtons: ToolbarButton[]
  insertButtons: ToolbarButton[]
  insertSyntax: (before: string, after?: string) => void
  mode: Mode
  onModeChange: (mode: Mode) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  editorStyle: EditorStyle
  onEditorStyleChange: (style: EditorStyle) => void
  autosaveInterval: AutosaveIntervalSeconds
  onAutosaveIntervalChange: (seconds: AutosaveIntervalSeconds) => void
  filePath: string | null
  isDirty: boolean
}

const AUTOSAVE_INTERVALS: { value: AutosaveIntervalSeconds; label: string }[] = [
  { value: 30, label: 'Autosave: 30s' },
  { value: 60, label: 'Autosave: 1 min' },
  { value: 120, label: 'Autosave: 2 min' }
]

const HEADING_MAP: Record<string, string> = {
  h1: '+ ',
  h2: '++ ',
  h3: '+++ ',
  h4: '++++ '
}

export default function Toolbar({
  fileButtons,
  homeButtons,
  insertButtons,
  insertSyntax,
  mode,
  onModeChange,
  theme,
  onThemeChange,
  editorStyle,
  onEditorStyleChange,
  autosaveInterval,
  onAutosaveIntervalChange,
  filePath,
  isDirty
}: ToolbarProps): React.JSX.Element {
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('home')
  const [docTab, setDocTab] = useState<'editor' | 'history'>('editor')
  const isDark = theme === 'scp'
  const isPaper = editorStyle === 'paper'
  const name = filePath ? filePath.replace(/^.*[/\\]/, '') : 'Untitled'

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <span className="toolbar-doc-title">
          {isDirty && <span className="toolbar-dirty-dot">● </span>}
          {name}
        </span>
        <span className="toolbar-meta">{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>

        <div className="toolbar-divider" />
        <div className="toolbar-doc-tabs">
          <button
            className={`toolbar-doc-tab ${docTab === 'editor' ? 'active' : ''}`}
            onClick={() => setDocTab('editor')}
          >
            Editor
          </button>
          <button
            className="toolbar-doc-tab toolbar-stub"
            title="Planned — .scratch/tier-2-history-and-editor-safety/draft-snapshots-diffs.md, not built yet"
            onClick={() => setDocTab('history')}
          >
            <History size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
            Version History
          </button>
        </div>

        <div className="toolbar-spacer" />

        <button
          className="toolbar-badge"
          title="Open mapping question — no article-status concept exists yet"
        >
          Draft ▾
        </button>
        <button
          className="toolbar-btn toolbar-stub"
          title="Open mapping question — comments have no home yet"
        >
          <MessageSquare size={14} />
        </button>
        <button
          className="toolbar-export toolbar-stub"
          title="Planned — .scratch/tier-3-images-and-export/wikidot-clipboard-export.md, not built yet"
        >
          <Download size={13} />
          Export
        </button>
      </div>

      <div className="toolbar-row toolbar-row-ribbon">
        <div className="ribbon-tabs">
          <button
            className={`ribbon-tab ${ribbonTab === 'home' ? 'active' : ''}`}
            onClick={() => setRibbonTab('home')}
          >
            Home
          </button>
          <button
            className={`ribbon-tab ${ribbonTab === 'insert' ? 'active' : ''}`}
            title="Block-level snippets — tables, logs, addenda. Not to be confused with the inline formatting on the Home tab."
            onClick={() => setRibbonTab('insert')}
          >
            Insert
          </button>
        </div>

        <div className="toolbar-spacer" />

        {fileButtons.map((b) => {
          const Icon = b.icon
          return (
            <button key={b.label} className="toolbar-btn" title={b.title} onClick={b.action}>
              <Icon size={14} />
            </button>
          )
        })}

        <div className="toolbar-divider" />

        <select
          className="toolbar-select"
          title="View mode"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as Mode)}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          className="toolbar-select"
          title="How often unsaved changes are backed up"
          value={autosaveInterval}
          onChange={(e) =>
            onAutosaveIntervalChange(Number(e.target.value) as AutosaveIntervalSeconds)
          }
        >
          {AUTOSAVE_INTERVALS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          className="toolbar-btn"
          title={isPaper ? 'Switch to code editor style' : 'Switch to paper editor style'}
          onClick={() => onEditorStyleChange(isPaper ? 'code' : 'paper')}
        >
          {isPaper ? <Code size={14} /> : <FileText size={14} />}
        </button>
        <button
          className="toolbar-btn"
          title={isDark ? 'Switch to Docs Light theme' : 'Switch to SCP Dark theme'}
          onClick={() => onThemeChange(isDark ? 'docs' : 'scp')}
        >
          {isDark ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>

      <div className="toolbar-row toolbar-row-buttons">
        {ribbonTab === 'home' ? (
          <>
            <button className="toolbar-btn toolbar-stub" title="Undo (use Ctrl+Z for now)">
              <Undo2 size={14} />
            </button>
            <button className="toolbar-btn toolbar-stub" title="Redo (use Ctrl+Y for now)">
              <Redo2 size={14} />
            </button>

            <div className="toolbar-divider" />

            <select
              className="toolbar-select"
              title="Paragraph style"
              defaultValue="normal"
              onChange={(e) => {
                if (HEADING_MAP[e.target.value]) insertSyntax(HEADING_MAP[e.target.value])
                e.target.value = 'normal'
              }}
            >
              <option value="normal">Normal Text</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
            </select>

            <select
              className="toolbar-select toolbar-stub"
              title="No Wikidot equivalent — placeholder"
            >
              <option>Inter</option>
            </select>
            <select
              className="toolbar-select toolbar-stub"
              title="No Wikidot equivalent — placeholder"
            >
              <option>18</option>
            </select>

            <div className="toolbar-divider" />

            {homeButtons.map((b) => {
              const Icon = b.icon
              const unsupported = mode === 'richtext' && b.richTextSupported === false
              return (
                <button
                  key={b.label}
                  className={`toolbar-btn ${unsupported ? 'toolbar-stub' : ''}`}
                  title={unsupported ? 'Not available in Rich Text mode' : b.title}
                  onClick={b.action}
                  disabled={unsupported}
                >
                  <Icon size={14} />
                </button>
              )
            })}

            <div className="toolbar-divider" />

            <button
              className="toolbar-btn"
              title="Center block (real, [[=]]…[[/=]])"
              onClick={() => insertSyntax('[[=]]\n', '\n[[/=]]')}
            >
              <AlignCenter size={14} />
            </button>
            <button
              className="toolbar-btn toolbar-stub"
              title="Left/right/justify have no clean Wikidot equivalent"
            >
              <AlignLeft size={14} />
            </button>
          </>
        ) : (
          <>
            {insertButtons.map((b) => {
              const Icon = b.icon
              const unsupported = mode === 'richtext' && b.richTextSupported === false
              return (
                <button
                  key={b.label}
                  className={`toolbar-btn ${unsupported ? 'toolbar-stub' : ''}`}
                  title={unsupported ? 'Not available in Rich Text mode' : b.title}
                  onClick={b.action}
                  disabled={unsupported}
                >
                  <Icon size={14} />
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
