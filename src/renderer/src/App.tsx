import { useEffect, useRef, useState } from 'react'
import Toolbar, { type Mode, type ToolbarButton } from './components/Toolbar'
import Editor, { type EditorHandle } from './components/Editor'
import PreviewPane from './components/PreviewPane'
import StatusBar from './components/StatusBar'
import { presubstitute } from './lib/wikidot-presubstitute'

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

const RENDER_DEBOUNCE_MS = 250

function App(): React.JSX.Element {
  const [source, setSource] = useState(STARTER)
  const [mode, setMode] = useState<Mode>('split')
  const [html, setHtml] = useState('')
  const [errors, setErrors] = useState<unknown[]>([])
  const editorRef = useRef<EditorHandle>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const timer = setTimeout(() => {
      const substituted = presubstitute(source)
      window.api.renderWikitext(substituted).then((result) => {
        if (requestId !== requestIdRef.current) return // stale response, a newer edit superseded it
        setHtml(result.html)
        setErrors(result.errors)
      })
    }, RENDER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [source])

  const insertSyntax = (before: string, after = ''): void => {
    editorRef.current?.insertSyntax(before, after)
  }

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
      <Toolbar buttons={toolbarButtons} mode={mode} onModeChange={setMode} />
      <div className="app-main">
        {(mode === 'edit' || mode === 'split') && (
          <div className={mode === 'split' ? 'editor-pane editor-pane-split' : 'editor-pane'}>
            <Editor ref={editorRef} value={source} onChange={setSource} />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && <PreviewPane html={html} />}
      </div>
      <StatusBar errors={errors} />
    </div>
  )
}

export default App
