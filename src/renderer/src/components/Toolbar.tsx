import { useState, type ComponentType } from 'react'
import {
  AlignCenter,
  AlignLeft,
  Brackets,
  Code,
  Download,
  FileText,
  History,
  MessageSquare,
  Moon,
  Quote,
  Redo2,
  Sun,
  TriangleAlert,
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
  // RedactionGlyph.tsx, which renders "█" instead of an SVG).
  icon: ComponentType<{ size?: number }>
  // false marks a button with no Rich Text destination (no MARK_COMMANDS
  // entry) — greyed out/disabled instead of silently no-op'ing in richtext
  // mode. Omitted/true means it works everywhere.
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
  autoClose: boolean
  onAutoCloseChange: (on: boolean) => void
  lintUnclosedTags: boolean
  onLintUnclosedTagsChange: (on: boolean) => void
  smartQuotes: boolean
  onSmartQuotesChange: (on: boolean) => void
  filePath: string | null
  isDirty: boolean
  docTab: 'editor' | 'history'
  onDocTabChange: (tab: 'editor' | 'history') => void
  onExport: () => void
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

const TEXT_SIZES: { value: string; label: string }[] = [
  { value: 'smaller', label: 'Smaller' },
  { value: '80%', label: '80%' },
  { value: '100%', label: '100%' },
  { value: '120%', label: '120%' },
  { value: '150%', label: '150%' },
  { value: '200%', label: '200%' },
  { value: 'larger', label: 'Larger' }
]

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
  autoClose,
  onAutoCloseChange,
  lintUnclosedTags,
  onLintUnclosedTagsChange,
  smartQuotes,
  onSmartQuotesChange,
  filePath,
  isDirty,
  docTab,
  onDocTabChange,
  onExport
}: ToolbarProps): React.JSX.Element {
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('home')
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
            onClick={() => onDocTabChange('editor')}
          >
            Editor
          </button>
          <button
            className={`toolbar-doc-tab ${docTab === 'history' ? 'active' : ''} ${filePath ? '' : 'toolbar-stub'}`}
            title={filePath ? 'View version history' : 'Save the file to enable version history'}
            disabled={!filePath}
            onClick={() => onDocTabChange('history')}
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
          className="toolbar-export"
          title="Copy cleaned-up Wikidot source to the clipboard, for pasting into the real wiki"
          onClick={onExport}
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
          className={`toolbar-btn${autoClose ? ' toolbar-btn-active' : ''}`}
          title={
            autoClose
              ? 'Auto-close brackets: on (click to disable)'
              : 'Auto-close brackets: off (click to enable)'
          }
          onClick={() => onAutoCloseChange(!autoClose)}
        >
          <Brackets size={14} />
        </button>
        <button
          className={`toolbar-btn${lintUnclosedTags ? ' toolbar-btn-active' : ''}`}
          title={
            lintUnclosedTags
              ? 'Flag unclosed tags: on (click to disable)'
              : 'Flag unclosed tags: off (click to enable)'
          }
          onClick={() => onLintUnclosedTagsChange(!lintUnclosedTags)}
        >
          <TriangleAlert size={14} />
        </button>
        <button
          className={`toolbar-btn${smartQuotes ? ' toolbar-btn-active' : ''}`}
          title={
            smartQuotes
              ? 'Smart quotes: on (click to disable)'
              : 'Smart quotes: off (click to enable)'
          }
          onClick={() => onSmartQuotesChange(!smartQuotes)}
        >
          <Quote size={14} />
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
              className="toolbar-select"
              title="Text size ([[size ...]])"
              defaultValue="100%"
              onChange={(e) => {
                if (e.target.value !== '100%') {
                  insertSyntax(`[[size ${e.target.value}]]`, '[[/size]]')
                }
                e.target.value = '100%'
              }}
            >
              {TEXT_SIZES.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
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
