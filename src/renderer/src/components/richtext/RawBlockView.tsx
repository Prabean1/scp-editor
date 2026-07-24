// NodeView for a rawBlock: the display for anything Rich Text v2 doesn't
// rich-edit in place (tables, collapsibles, the SCP-component fakes,
// includes — see ftml-ast.ts's classifyChunk). There's no rich alternative
// for these, so — unlike a right-click "Raw Text" escape hatch on a heading/
// paragraph — a plain click here is the only way in, matching how v1
// handled every block.
import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { presubstitute } from '../../lib/wikidot-presubstitute'
import type { PageInfoInput } from './schema'

export default function RawBlockView({
  node,
  getPos,
  extension
}: NodeViewProps): React.JSX.Element {
  const raw = node.attrs.raw as string
  const { pageInfoRef, onCommitRaw } = extension.options as {
    pageInfoRef: { current: PageInfoInput }
    onCommitRaw: (pos: number, nodeSize: number, rawText: string) => void
  }
  const [editing, setEditing] = useState(Boolean(node.attrs.startEditing))
  const [html, setHtml] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Not a plain `autoFocus` prop: ProseMirror re-asserts focus on its own
  // contentEditable root as part of handling the same mousedown that opened
  // this textarea (it's taking a NodeSelection on this node), which steals
  // focus back immediately and fires this textarea's onBlur before the user
  // ever sees it — confirmed empirically (editing flipped true then straight
  // back to false within one interaction). Focusing one frame later lets
  // ProseMirror's own handling finish first, so this call wins last.
  useEffect(() => {
    if (!editing) return
    const raf = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [editing])

  useEffect(() => {
    if (editing) return
    let cancelled = false
    window.api.renderWikitext(presubstitute(raw), pageInfoRef.current).then((result) => {
      if (!cancelled) setHtml(result.html)
    })
    return () => {
      cancelled = true
    }
  }, [raw, editing, pageInfoRef])

  function finishEditing(): void {
    setEditing(false)
    const nextText = textareaRef.current?.value ?? raw
    const pos = getPos()
    if (nextText !== raw && pos !== undefined) onCommitRaw(pos, node.nodeSize, nextText)
  }

  return (
    <NodeViewWrapper className="richtext-raw-block" contentEditable={false}>
      {editing ? (
        <textarea
          ref={textareaRef}
          className="richtext-block-edit"
          defaultValue={raw}
          onBlur={finishEditing}
        />
      ) : (
        <div
          className="richtext-block"
          title="Click to edit raw Wikidot for this block"
          // Not onClick: this node is `atom`+`selectable` (schema.ts), and
          // ProseMirror's own mousedown handling for such nodes (it takes
          // the NodeSelection itself) swallows the click before a `click`
          // event is ever synthesized — confirmed empirically (mousedown
          // fires, click never does). `button === 0` excludes a right-click's
          // own mousedown, which should only open the context menu
          // (RichTextEditor.tsx's onContextMenu), not also enter edit mode.
          onMouseDown={(e) => {
            if (e.button === 0) setEditing(true)
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  )
}
