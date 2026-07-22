import { useState } from 'react'

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

function App(): React.JSX.Element {
  const [source, setSource] = useState(STARTER)
  const [html, setHtml] = useState('')
  const [errors, setErrors] = useState<unknown[]>([])

  const handleRender = async (): Promise<void> => {
    const result = await window.api.renderWikitext(source)
    setHtml(result.html)
    setErrors(result.errors)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 8 }}>
      <button onClick={handleRender} style={{ marginBottom: 8, alignSelf: 'flex-start' }}>
        Render via ftml (IPC)
      </button>
      <div style={{ display: 'flex', flex: 1, gap: 8, minHeight: 0 }}>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
        />
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #ccc', padding: 8 }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {errors.length > 0 && (
            <pre style={{ color: 'crimson' }}>{JSON.stringify(errors, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
