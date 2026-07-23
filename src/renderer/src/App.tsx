import { useEffect, useMemo, useRef, useState } from 'react'
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
import WysiwygEditor, { type WysiwygEditorHandle } from './components/WysiwygEditor'
import { presubstitute } from './lib/wikidot-presubstitute'
import {
  getStoredEditorStyle,
  getStoredSplit,
  getStoredTheme,
  setEditorStyle as persistEditorStyle,
  setSplit as persistSplit,
  setTheme as persistTheme,
  MIN_SPLIT,
  MAX_SPLIT,
  type EditorStyle,
  type Theme
} from './lib/theme'

const MIN_PANE_PX = 250

interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

const STARTER = `[[include :scp-wiki:component:license-box]]

+ Item #: SCP-XXXX

+ Object Class: Euclid

+ Special Containment Procedures

Write your containment procedures here. This is a **placeholder** —
the no-AI-content rule for this project means you write every word
of the actual article yourself.

+ Description

This paragraph is example body text so you can see how a normal
paragraph renders. //Italics//, **bold**, __underline__, and
--strikethrough-- all work.

[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]
Addendum content goes here. Collapsibles are common for
interview logs and incident reports.
[[/collapsible]]

||~ Column A||~ Column B||
||Row 1||Data||
||Row 2||Data||

[[module Rate]]
`

const DEFAULT_PAGE_INFO: PageInfoInput = {
  page: 'untitled',
  category: null,
  site: 'scp-wiki',
  title: 'Untitled',
  alt_title: null,
  score: 0,
  tags: [],
  language: 'en'
}

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
  const [source, setSource] = useState(STARTER)
  const [pageInfo, setPageInfo] = useState<PageInfoInput>(DEFAULT_PAGE_INFO)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<{
    source: string
    pageInfo: PageInfoInput
  } | null>({ source: STARTER, pageInfo: DEFAULT_PAGE_INFO })
  const [mode, setMode] = useState<Mode>('split')
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [editorStyle, setEditorStyle] = useState<EditorStyle>(getStoredEditorStyle)
  const [split, setSplit] = useState<number>(getStoredSplit)
  const [html, setHtml] = useState('')
  const [errors, setErrors] = useState<unknown[]>([])
  const [showPageInfo, setShowPageInfo] = useState(false)
  const editorRef = useRef<EditorHandle>(null)
  const wysiwygRef = useRef<WysiwygEditorHandle>(null)
  const requestIdRef = useRef(0)
  const appMainRef = useRef<HTMLDivElement>(null)

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false
    return (
      source !== savedSnapshot.source ||
      JSON.stringify(pageInfo) !== JSON.stringify(savedSnapshot.pageInfo)
    )
  }, [source, pageInfo, savedSnapshot])

  // Menu-triggered and window-close-triggered actions fire on IPC events
  // subscribed once at mount; this ref lets those long-lived callbacks
  // always read current state instead of closing over the state from the
  // render they were subscribed in.
  const stateRef = useRef({ source, pageInfo, filePath, isDirty })
  useEffect(() => {
    stateRef.current = { source, pageInfo, filePath, isDirty }
  })

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const timer = setTimeout(() => {
      const substituted = presubstitute(source)
      window.api.renderWikitext(substituted, pageInfo).then((result) => {
        if (requestId !== requestIdRef.current) return // stale response, a newer edit superseded it
        setHtml(result.html)
        setErrors(result.errors)
      })
    }, RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [source, pageInfo])

  useEffect(() => {
    window.api.setDirty(isDirty)
  }, [isDirty])

  useEffect(() => {
    const name = filePath ? filePath.replace(/^.*[/\\]/, '') : 'Untitled'
    document.title = `${isDirty ? '● ' : ''}${name} — SCP Doc Editor`
  }, [filePath, isDirty])

  function applyArticle(article: {
    filePath: string
    source: string
    pageInfo: PageInfoInput
  }): void {
    setSource(article.source)
    setPageInfo(article.pageInfo)
    setFilePath(article.filePath)
    setSavedSnapshot({ source: article.source, pageInfo: article.pageInfo })
  }

  async function performSaveAs(): Promise<boolean> {
    const { source: currentSource, pageInfo: currentPageInfo } = stateRef.current
    const newPath = await window.api.saveFileDialog(
      currentSource,
      currentPageInfo,
      currentPageInfo.page
    )
    if (!newPath) return false
    setFilePath(newPath)
    setSavedSnapshot({ source: currentSource, pageInfo: currentPageInfo })
    return true
  }

  async function performSave(): Promise<boolean> {
    const {
      source: currentSource,
      pageInfo: currentPageInfo,
      filePath: currentPath
    } = stateRef.current
    if (currentPath) {
      await window.api.saveFile(currentPath, currentSource, currentPageInfo)
      setSavedSnapshot({ source: currentSource, pageInfo: currentPageInfo })
      return true
    }
    return performSaveAs()
  }

  async function guardDirty(): Promise<boolean> {
    if (!stateRef.current.isDirty) return true
    const choice = await window.api.confirmDiscard()
    if (choice === 'cancel') return false
    if (choice === 'save') return performSave()
    return true
  }

  async function handleNew(): Promise<void> {
    if (!(await guardDirty())) return
    setSource(STARTER)
    setPageInfo(DEFAULT_PAGE_INFO)
    setFilePath(null)
    setSavedSnapshot({ source: STARTER, pageInfo: DEFAULT_PAGE_INFO })
  }

  async function handleOpen(): Promise<void> {
    if (!(await guardDirty())) return
    const article = await window.api.openFileDialog()
    if (article) applyArticle(article)
  }

  async function handleOpenPath(path: string): Promise<void> {
    if (!(await guardDirty())) return
    const article = await window.api.openFilePath(path)
    if (article) applyArticle(article)
  }

  useEffect(() => {
    const unsubs = [
      window.api.onMenuNew(() => {
        handleNew()
      }),
      window.api.onMenuOpen(() => {
        handleOpen()
      }),
      window.api.onMenuSave(() => {
        performSave()
      }),
      window.api.onMenuSaveAs(() => {
        performSaveAs()
      }),
      window.api.onMenuOpenPath((path) => {
        handleOpenPath(path)
      }),
      window.api.onSaveBeforeClose(async () => {
        const ok = await performSave()
        window.api.reportSaveBeforeCloseResult(ok)
      })
    ]
    return () => unsubs.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insertSyntax = (before: string, after = ''): void => {
    if (mode === 'wysiwyg') {
      wysiwygRef.current?.insertSyntax(before, after)
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
    { label: 'New', title: 'New (Ctrl+N)', icon: FilePlus, action: () => handleNew() },
    { label: 'Open', title: 'Open… (Ctrl+O)', icon: FolderOpen, action: () => handleOpen() },
    { label: 'Save', title: 'Save (Ctrl+S)', icon: Save, action: () => performSave() },
    {
      label: 'Save As',
      title: 'Save As… (Ctrl+Shift+S)',
      icon: SaveAll,
      action: () => performSaveAs()
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
      action: () => insertSyntax('##red|', '##')
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
      action: () => insertSyntax('{{', '}}')
    },
    {
      label: 'Bulleted list',
      title: 'Bulleted list',
      icon: List,
      action: () => insertSyntax('* ')
    },
    {
      label: 'Numbered list',
      title: 'Numbered list',
      icon: ListOrdered,
      action: () => insertSyntax('# ')
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
      action: () => insertSyntax('||', '||content||')
    },
    {
      label: 'Collapsible',
      title: 'Collapsible',
      icon: ChevronDown,
      action: () =>
        insertSyntax('[[collapsible show="+ show" hide="- hide"]]\n', '\n[[/collapsible]]')
    },
    {
      label: 'Horizontal rule',
      title: 'Horizontal rule',
      icon: Minus,
      action: () => insertSyntax('\n----\n')
    },
    {
      label: 'Link',
      title: 'Link ([[[page|text]]])',
      icon: Link2,
      action: () => insertSyntax('[[[', '|text]]]')
    },
    {
      label: 'Image',
      title: 'Image ([[image url]])',
      icon: ImageIcon,
      action: () => insertSyntax('[[image ', ']]')
    },
    {
      label: 'Addendum',
      title: 'Insert an addendum block',
      icon: MessageCircle,
      action: () =>
        insertSyntax(
          '+ Addendum\n[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]\nAddendum content goes here.\n[[/collapsible]]\n'
        )
    },
    {
      label: 'Interview log',
      title: 'Insert an interview log table',
      icon: Table,
      action: () =>
        insertSyntax(
          '||~ Speaker||~ Dialogue||\n||Dr. ██████||Line of dialogue.||\n||Subject||Response.||\n'
        )
    },
    {
      label: 'Incident log',
      title: 'Insert an incident log scaffold',
      icon: FilePlus,
      action: () =>
        insertSyntax(
          '+ Incident Log\n**Date:** ██/██/████\n\n**Involved Personnel:** \n\n**Description of Incident:** \n'
        )
    },
    {
      label: 'Danger class display',
      title:
        'Insert an object/danger class bar (starter scaffold — verify params before publishing)',
      icon: ShieldAlert,
      action: () =>
        insertSyntax(
          '[[include :scp-wiki:component:anomaly-class-bar-source\n|item-number=XXXX\n|clearance=3\n|container-class=safe\n|secondary-class=none\n|disruption-class=dark\n|risk-class=notice\n]]\n'
        )
    },
    {
      label: 'Redaction',
      title: 'Insert a redaction block (█)',
      icon: RedactionGlyph,
      action: () => insertSyntax('█')
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
        filePath={filePath}
        isDirty={isDirty}
      />
      <div className="app-main" ref={appMainRef}>
        {(mode === 'edit' || mode === 'split') && (
          <div
            className="editor-pane"
            style={mode === 'split' ? { flex: `0 0 ${split * 100}%` } : undefined}
          >
            <Editor ref={editorRef} value={source} onChange={setSource} editorStyle={editorStyle} />
          </div>
        )}
        {mode === 'split' && <div className="split-divider" onPointerDown={startResize} />}
        {(mode === 'preview' || mode === 'split') && <PreviewPane html={html} />}
        {mode === 'wysiwyg' && (
          <WysiwygEditor
            ref={wysiwygRef}
            source={source}
            onChange={setSource}
            pageInfo={pageInfo}
          />
        )}
      </div>
      <StatusBar errors={errors} filePath={filePath} isDirty={isDirty} />
      {showPageInfo && (
        <PageInfoModal
          pageInfo={pageInfo}
          onSave={(updated) => {
            setPageInfo(updated)
            setShowPageInfo(false)
          }}
          onCancel={() => setShowPageInfo(false)}
        />
      )}
    </div>
  )
}

export default App
