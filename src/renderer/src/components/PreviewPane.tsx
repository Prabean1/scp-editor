import '../assets/preview.css'

interface PreviewPaneProps {
  html: string
}

export default function PreviewPane({ html }: PreviewPaneProps): React.JSX.Element {
  return (
    <div className="preview-pane">
      <div className="scp-page-wrap" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
