import { useEffect, useRef } from 'react'
import { buildFrameDoc } from '../lib/preview-frame'

interface PreviewPaneProps {
  html: string
}

// buildFrameDoc() runs once per mount, not per html change — recomputing srcDoc would tear
// down the frame document mid-edit. Content updates go through postMessage instead.
export default function PreviewPane({ html }: PreviewPaneProps): React.JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const srcDocRef = useRef<string | undefined>(undefined)
  if (srcDocRef.current === undefined) srcDocRef.current = buildFrameDoc()

  // Buffers the latest html until the frame's own script has loaded and signalled readiness —
  // a postMessage sent before that listener exists is silently dropped.
  const readyRef = useRef(false)
  const pendingRef = useRef(html)
  pendingRef.current = html

  function sendRender(renderedHtml: string): void {
    frameRef.current?.contentWindow?.postMessage({ type: 'preview-render', html: renderedHtml }, '*')
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      if (event.source !== frameRef.current?.contentWindow) return
      const data = event.data as { type?: string; href?: string }
      if (data?.type === 'preview-ready') {
        readyRef.current = true
        sendRender(pendingRef.current)
      } else if (data?.type === 'preview-link' && data.href) {
        // Routes through the app's existing setWindowOpenHandler -> shell.openExternal,
        // same as a link click did before content moved inside the iframe.
        window.open(data.href)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (readyRef.current) sendRender(html)
  }, [html])

  return (
    <div className="preview-pane">
      <iframe
        ref={frameRef}
        className="preview-frame"
        sandbox="allow-scripts"
        srcDoc={srcDocRef.current}
        title="Preview"
      />
    </div>
  )
}
