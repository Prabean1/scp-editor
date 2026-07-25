import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  ChevronDown,
  Code2,
  FilePlus,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageCircle,
  Minus,
  Palette,
  Save,
  SaveAll,
  ShieldAlert,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline
} from 'lucide-react'
import Toolbar, { type Mode, type ToolbarButton } from './components/Toolbar'
import Editor, { type EditorHandle } from './components/Editor'
import PreviewPane from './components/PreviewPane'
import StatusBar from './components/StatusBar'
import PageInfoModal from './components/PageInfoModal'
import HistoryPanel from './components/HistoryPanel'
import RichTextEditor, { type RichTextEditorHandle } from './components/RichTextEditor'
import { useDocument } from './hooks/useDocument'
import { presubstitute } from './lib/wikidot-presubstitute'
import {
  getStoredEditorStyle,
  getStoredSplit,
  getStoredTheme,
  getStoredAutosaveInterval,
  getStoredAutoClose,
  getStoredLintUnclosedTags,
  getStoredSmartQuotes,
  setEditorStyle as persistEditorStyle,
  setSplit as persistSplit,
  setTheme as persistTheme,
  setAutosaveInterval as persistAutosaveInterval,
  setAutoClose as persistAutoClose,
  setLintUnclosedTags as persistLintUnclosedTags,
  setSmartQuotes as persistSmartQuotes,
  MIN_SPLIT,
  MAX_SPLIT,
  type EditorStyle,
  type Theme,
  type AutosaveIntervalSeconds
} from './lib/theme'

const MIN_PANE_PX = 250

const RENDER_DEBOUNCE_MS = 250

// The redaction button's icon IS the character it inserts, not a stand-in
// symbol — so the button reads as "click to get more of this" rather
// than needing a separate icon to explain what it does.
function RedactionGlyph({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <span style={{ fontSize: size, lineHeight: 1, fontFamily: 'monospace' }} aria-hidden="true">
      █
    </span>
  )
}

function App(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('split')
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [editorStyle, setEditorStyle] = useState<EditorStyle>(getStoredEditorStyle)
  const [split, setSplit] = useState<number>(getStoredSplit)
  const [autosaveInterval, setAutosaveIntervalState] =
    useState<AutosaveIntervalSeconds>(getStoredAutosaveInterval)
  const [autoClose, setAutoCloseState] = useState<boolean>(getStoredAutoClose)
  const [lintUnclosedTags, setLintUnclosedTagsState] = useState<boolean>(getStoredLintUnclosedTags)
  const [smartQuotes, setSmartQuotesState] = useState<boolean>(getStoredSmartQuotes)
  const [html, setHtml] = useState('')
  const [errors, setErrors] = useState<unknown[]>([])
  const [showPageInfo, setShowPageInfo] = useState(false)
  const [docTab, setDocTab] = useState<'editor' | 'history'>('editor')
  const editorRef = useRef<EditorHandle>(null)
  const richTextRef = useRef<RichTextEditorHandle>(null)
  const requestIdRef = useRef(0)
  const appMainRef = useRef<HTMLDivElement>(null)

  const doc = useDocument(autosaveInterval)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const timer = setTimeout(() => {
      const substituted = presubstitute(doc.source)
      window.api.renderWikitext(substituted, doc.pageInfo).then((result) => {
        if (requestId !== requestIdRef.current) return // stale response, a newer edit superseded it
        setHtml(result.html)
        setErrors(result.errors)
      })
    }, RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [doc.source, doc.pageInfo])

  useEffect(() => {
    const name = doc.filePath ? doc.filePath.replace(/^.*[/\\]/, '') : 'Untitled'
    document.title = `${doc.isDirty ? '● ' : ''}${name} — SCP Doc Editor`
  }, [doc.filePath, doc.isDirty])

  async function handleDropImage(file: File): Promise<string | null> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const saved = await window.api.imageSave(doc.imageOwner, file.name, bytes)
    if (!saved) {
      window.alert(`"${file.name}" isn't a supported image format (png, jpg, gif, webp).`)
      return null
    }
    return `[[image local:${saved.id}]]`
  }

  const handleAutosaveIntervalChange = (next: AutosaveIntervalSeconds): void => {
    persistAutosaveInterval(next)
    setAutosaveIntervalState(next)
  }

  const insertSyntax = (before: string, after = ''): void => {
    if (mode === 'richtext') {
      richTextRef.current?.insertSyntax(before, after)
    } else {
      editorRef.current?.insertSyntax(before, after)
    }
  }

  const handleThemeChange = (next: Theme): void => {
    persistTheme(next)
    setTheme(next)
  }

  const handleEditorStyleChange = (next: EditorStyle): void => {
    persistEditorStyle(next)
    setEditorStyle(next)
  }

  const handleAutoCloseChange = (next: boolean): void => {
    persistAutoClose(next)
    setAutoCloseState(next)
  }

  const handleLintUnclosedTagsChange = (next: boolean): void => {
    persistLintUnclosedTags(next)
    setLintUnclosedTagsState(next)
  }

  const handleSmartQuotesChange = (next: boolean): void => {
    persistSmartQuotes(next)
    setSmartQuotesState(next)
  }

  const startResize = (downEvent: React.PointerEvent<HTMLDivElement>): void => {
    downEvent.preventDefault()
    let latestSplit = split

    const handleMove = (moveEvent: PointerEvent): void => {
      const rect = appMainRef.current?.getBoundingClientRect()
      if (!rect) return
      const editorPx = moveEvent.clientX - rect.left
      const minPx = Math.min(MIN_PANE_PX, rect.width / 2)
      const clampedPx = Math.min(Math.max(editorPx, minPx), rect.width - minPx)
      latestSplit = Math.min(Math.max(clampedPx / rect.width, MIN_SPLIT), MAX_SPLIT)
      setSplit(latestSplit)
    }

    const handleUp = (): void => {
      persistSplit(latestSplit)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const fileButtons: ToolbarButton[] = [
    { label: 'New', title: 'New (Ctrl+N)', icon: FilePlus, action: () => doc.new() },
    { label: 'Open', title: 'Open… (Ctrl+O)', icon: FolderOpen, action: () => doc.open() },
    { label: 'Save', title: 'Save (Ctrl+S)', icon: Save, action: () => doc.save() },
    {
      label: 'Save As',
      title: 'Save As… (Ctrl+Shift+S)',
      icon: SaveAll,
      action: () => doc.saveAs()
    },
    {
      label: 'Page Info',
      title: 'Edit page metadata',
      icon: Info,
      action: () => setShowPageInfo(true)
    }
  ]

  // Inline formatting — toggles/wraps within a line. Lives on the Home
  // ribbon tab. Not to be confused with insertButtons below (block-level
  // snippets), per the user's explicit distinction (2026-07-23).
  const homeButtons: ToolbarButton[] = [
    {
      label: 'Colour',
      title: 'Insert coloured text (##red|…##)',
      icon: Palette,
      action: () => insertSyntax('##red|', '##'),
      richTextSupported: false
    },
    { label: 'Bold', title: 'Bold', icon: Bold, action: () => insertSyntax('**', '**') },
    { label: 'Italic', title: 'Italic', icon: Italic, action: () => insertSyntax('//', '//') },
    {
      label: 'Underline',
      title: 'Underline',
      icon: Underline,
      action: () => insertSyntax('__', '__')
    },
    {
      label: 'Strikethrough',
      title: 'Strikethrough',
      icon: Strikethrough,
      action: () => insertSyntax('--', '--')
    },
    {
      label: 'Inline code',
      title: 'Inline code ({{…}})',
      icon: Code2,
      action: () => insertSyntax('{{', '}}'),
      richTextSupported: false
    },
    {
      label: 'Bulleted list',
      title: 'Bulleted list',
      icon: List,
      action: () => insertSyntax('* '),
      richTextSupported: false
    },
    {
      label: 'Numbered list',
      title: 'Numbered list',
      icon: ListOrdered,
      action: () => insertSyntax('# '),
      richTextSupported: false
    },
    {
      label: 'Subscript',
      title: 'Subscript (,,…,,)',
      icon: Subscript,
      action: () => insertSyntax(',,', ',,')
    },
    {
      label: 'Superscript',
      title: 'Superscript (^^…^^)',
      icon: Superscript,
      action: () => insertSyntax('^^', '^^')
    }
  ]

  // Block-level placeholders — whole sections dropped in at the cursor,
  // not wrapped around a selection. Lives on the Insert ribbon tab; see
  // .scratch/tier-1-foundations/redaction-and-presets.md for why these
  // are grouped separately from formatting.
  const insertButtons: ToolbarButton[] = [
    {
      label: 'Table',
      title: 'Table row',
      icon: Table,
      action: () => insertSyntax('||', '||content||'),
      richTextSupported: false
    },
    {
      label: 'Collapsible',
      title: 'Collapsible',
      icon: ChevronDown,
      action: () =>
        insertSyntax('[[collapsible show="+ show" hide="- hide"]]\n', '\n[[/collapsible]]'),
      richTextSupported: false
    },
    {
      label: 'Horizontal rule',
      title: 'Horizontal rule',
      icon: Minus,
      action: () => insertSyntax('\n----\n'),
      richTextSupported: false
    },
    {
      label: 'Link',
      title: 'Link ([[[page|text]]])',
      icon: Link2,
      action: () => insertSyntax('[[[', '|text]]]'),
      richTextSupported: false
    },
    {
      label: 'Image',
      title: 'Image ([[image url]])',
      icon: ImageIcon,
      action: () => insertSyntax('[[image ', ']]'),
      richTextSupported: false
    },
    {
      label: 'Addendum',
      title: 'Insert an addendum block',
      icon: MessageCircle,
      action: () =>
        insertSyntax(
          '+ Addendum\n[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]\nAddendum content goes here.\n[[/collapsible]]\n'
        ),
      richTextSupported: false
    },
    {
      label: 'Interview log',
      title: 'Insert an interview log table',
      icon: Table,
      action: () =>
        insertSyntax(
          '||~ Speaker||~ Dialogue||\n||Dr. ██████||Line of dialogue.||\n||Subject||Response.||\n'
        ),
      richTextSupported: false
    },
    {
      label: 'Incident log',
      title: 'Insert an incident log scaffold',
      icon: FilePlus,
      action: () =>
        insertSyntax(
          '+ Incident Log\n**Date:** ██/██/████\n\n**Involved Personnel:** \n\n**Description of Incident:** \n'
        ),
      richTextSupported: false
    },
    {
      label: 'Danger class display',
      title:
        'Insert an object/danger class bar (starter scaffold — verify params before publishing)',
      icon: ShieldAlert,
      action: () =>
        insertSyntax(
          '[[include :scp-wiki:component:anomaly-class-bar-source\n|item-number=XXXX\n|clearance=3\n|container-class=safe\n|secondary-class=none\n|disruption-class=dark\n|risk-class=notice\n]]\n'
        ),
      richTextSupported: false
    },
    {
      label: 'Redaction',
      title: 'Insert a redaction block (█)',
      icon: RedactionGlyph,
      action: () => insertSyntax('█'),
      richTextSupported: false
    }
  ]

  return (
    <div className="app-shell">
      <Toolbar
        fileButtons={fileButtons}
        homeButtons={homeButtons}
        insertButtons={insertButtons}
        insertSyntax={insertSyntax}
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeChange={handleThemeChange}
        editorStyle={editorStyle}
        onEditorStyleChange={handleEditorStyleChange}
        autosaveInterval={autosaveInterval}
        onAutosaveIntervalChange={handleAutosaveIntervalChange}
        autoClose={autoClose}
        onAutoCloseChange={handleAutoCloseChange}
        lintUnclosedTags={lintUnclosedTags}
        onLintUnclosedTagsChange={handleLintUnclosedTagsChange}
        smartQuotes={smartQuotes}
        onSmartQuotesChange={handleSmartQuotesChange}
        filePath={doc.filePath}
        isDirty={doc.isDirty}
        docTab={docTab}
        onDocTabChange={setDocTab}
        onExport={() => doc.export()}
      />
      <div className="app-main" ref={appMainRef}>
        {(mode === 'edit' || mode === 'split') && (
          <div
            className="editor-pane"
            style={mode === 'split' ? { flex: `0 0 ${split * 100}%` } : undefined}
          >
            <Editor
              ref={editorRef}
              value={doc.source}
              onChange={doc.setSource}
              editorStyle={editorStyle}
              autoClose={autoClose}
              lintUnclosedTags={lintUnclosedTags}
              smartQuotes={smartQuotes}
              onDropImage={handleDropImage}
            />
          </div>
        )}
        {mode === 'split' && <div className="split-divider" onPointerDown={startResize} />}
        {(mode === 'preview' || mode === 'split') && <PreviewPane html={html} />}
        {mode === 'richtext' && (
          <RichTextEditor
            ref={richTextRef}
            source={doc.source}
            onChange={doc.setSource}
            pageInfo={doc.pageInfo}
          />
        )}
      </div>
      {import.meta.env.DEV && (
        <StatusBar errors={errors} filePath={doc.filePath} isDirty={doc.isDirty} />
      )}
      {showPageInfo && (
        <PageInfoModal
          pageInfo={doc.pageInfo}
          onSave={(updated) => {
            doc.setPageInfo(updated)
            setShowPageInfo(false)
          }}
          onCancel={() => setShowPageInfo(false)}
        />
      )}
      {docTab === 'history' && doc.filePath && (
        <HistoryPanel
          filePath={doc.filePath}
          source={doc.source}
          onRestore={(record) => {
            doc.restoreSnapshot(record)
            setDocTab('editor')
          }}
          onClose={() => setDocTab('editor')}
        />
      )}
    </div>
  )
}

export default App
