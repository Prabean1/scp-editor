import { useEffect, useMemo, useRef, useState } from 'react'
import Toolbar, { type Mode, type ToolbarButton } from './components/Toolbar'
import Editor, { type EditorHandle } from './components/Editor'
import PreviewPane from './components/PreviewPane'
import StatusBar from './components/StatusBar'
import PageInfoModal from './components/PageInfoModal'
import { presubstitute } from './lib/wikidot-presubstitute'

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

function App(): React.JSX.Element {
  const [source, setSource] = useState(STARTER)
  const [pageInfo, setPageInfo] = useState<PageInfoInput>(DEFAULT_PAGE_INFO)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<{
    source: string
    pageInfo: PageInfoInput
  } | null>({ source: STARTER, pageInfo: DEFAULT_PAGE_INFO })
  const [mode, setMode] = useState<Mode>('split')
  const [html, setHtml] = useState('')
  const [errors, setErrors] = useState<unknown[]>([])
  const [showPageInfo, setShowPageInfo] = useState(false)
  const editorRef = useRef<EditorHandle>(null)
  const requestIdRef = useRef(0)

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
    editorRef.current?.insertSyntax(before, after)
  }

  const fileButtons: ToolbarButton[] = [
    { label: 'New', title: 'New (Ctrl+N)', action: () => handleNew() },
    { label: 'Open', title: 'Open… (Ctrl+O)', action: () => handleOpen() },
    { label: 'Save', title: 'Save (Ctrl+S)', action: () => performSave() },
    { label: 'Save As', title: 'Save As… (Ctrl+Shift+S)', action: () => performSaveAs() },
    { label: 'Page Info', title: 'Edit page metadata', action: () => setShowPageInfo(true) }
  ]

  const toolbarButtons: ToolbarButton[] = [
    { label: 'B', title: 'Bold', action: () => insertSyntax('**', '**') },
    { label: 'I', title: 'Italic', action: () => insertSyntax('//', '//') },
    { label: 'U', title: 'Underline', action: () => insertSyntax('__', '__') },
    { label: 'S', title: 'Strikethrough', action: () => insertSyntax('--', '--') },
    { label: 'H+', title: 'Heading', action: () => insertSyntax('+ ') },
    { label: '▦', title: 'Table row', action: () => insertSyntax('||', '||content||') },
    {
      label: '▾',
      title: 'Collapsible',
      action: () =>
        insertSyntax('[[collapsible show="+ show" hide="- hide"]]\n', '\n[[/collapsible]]')
    },
    { label: '―', title: 'Horizontal rule', action: () => insertSyntax('\n----\n') }
  ]

  return (
    <div className="app-shell">
      <Toolbar
        fileButtons={fileButtons}
        buttons={toolbarButtons}
        mode={mode}
        onModeChange={setMode}
      />
      <div className="app-main">
        {(mode === 'edit' || mode === 'split') && (
          <div className={mode === 'split' ? 'editor-pane editor-pane-split' : 'editor-pane'}>
            <Editor ref={editorRef} value={source} onChange={setSource} />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && <PreviewPane html={html} />}
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
