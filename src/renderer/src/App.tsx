import { useEffect, useRef, useState } from 'react'
import Toolbar, { type Mode } from './components/Toolbar'
import Editor, { type EditorHandle } from './components/Editor'
import PreviewPane from './components/PreviewPane'
import StatusBar from './components/StatusBar'
import PageInfoModal from './components/PageInfoModal'
import HistoryPanel from './components/HistoryPanel'
import RichTextEditor, { type RichTextEditorHandle } from './components/RichTextEditor'
import { createToolbarButtons } from './components/toolbar-config'
import { useDocument } from './hooks/useDocument'
import { presubstitute } from './lib/wikidot-presubstitute'
import { usePersistedSetting } from './lib/usePersistedSetting'
import {
  applyTheme,
  autoCloseSetting,
  autosaveIntervalSetting,
  editorStyleSetting,
  lintUnclosedTagsSetting,
  MIN_SPLIT,
  MAX_SPLIT,
  smartQuotesSetting,
  splitSetting,
  themeSetting,
  type AutosaveIntervalSeconds,
  type EditorStyle,
  type Theme
} from './lib/theme'

const MIN_PANE_PX = 250

const RENDER_DEBOUNCE_MS = 250

function App(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('split')
  const [theme, handleThemeChange] = usePersistedSetting<Theme>(
    themeSetting.key,
    themeSetting.codec,
    applyTheme
  )
  const [editorStyle, handleEditorStyleChange] = usePersistedSetting<EditorStyle>(
    editorStyleSetting.key,
    editorStyleSetting.codec
  )
  const [split, persistSplit, setSplitLocal] = usePersistedSetting(
    splitSetting.key,
    splitSetting.codec
  )
  const [autosaveInterval, handleAutosaveIntervalChange] =
    usePersistedSetting<AutosaveIntervalSeconds>(
      autosaveIntervalSetting.key,
      autosaveIntervalSetting.codec
    )
  const [autoClose, handleAutoCloseChange] = usePersistedSetting(
    autoCloseSetting.key,
    autoCloseSetting.codec
  )
  const [lintUnclosedTags, handleLintUnclosedTagsChange] = usePersistedSetting(
    lintUnclosedTagsSetting.key,
    lintUnclosedTagsSetting.codec
  )
  const [smartQuotes, handleSmartQuotesChange] = usePersistedSetting(
    smartQuotesSetting.key,
    smartQuotesSetting.codec
  )
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

  const insertSyntax = (before: string, after = ''): void => {
    if (mode === 'richtext') {
      richTextRef.current?.insertSyntax(before, after)
    } else {
      editorRef.current?.insertSyntax(before, after)
    }
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
      setSplitLocal(latestSplit)
    }

    const handleUp = (): void => {
      persistSplit(latestSplit)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  // insertSyntax reads refs only when a button's click handler calls it
  // later, not during render — eslint-disable needed since react-hooks/refs
  // can't see that far through the closure.
  // eslint-disable-next-line react-hooks/refs
  const { fileButtons, homeButtons, insertButtons } = createToolbarButtons({
    doc,
    insertSyntax,
    onShowPageInfo: () => setShowPageInfo(true)
  })

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
