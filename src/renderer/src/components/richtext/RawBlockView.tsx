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
  // splitAtCaret's setEditing(false) unmounts this textarea, and removing a
  // focused element fires a real (Chromium) blur synchronously during that
  // same commit — which would otherwise re-enter finishEditing with the
  // textarea's stale, un-split value right after splitAtCaret already
  // committed the split. This flag lets finishEditing recognize and skip
  // that redundant blur.
  const skipNextBlurRef = useRef(false)

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
    if (skipNextBlurRef.current) {
      skipNextBlurRef.current = false
      return
    }
    setEditing(false)
    const nextText = textareaRef.current?.value ?? raw
    const pos = getPos()
    // Always re-run the reclassify path on blur, even when nextText === raw
    // — a rich node temporarily dropped into Raw Text view (the right-click
    // escape hatch) needs this to turn back into a rich node again, and that
    // path only exists inside onCommitRaw. A genuine raw island (table,
    // include, etc.) just gets reclassified as raw again, which is a no-op
    // in effect.
    if (pos !== undefined) onCommitRaw(pos, node.nodeSize, nextText)
  }

  // Precise split: cuts the textarea's current (possibly-edited, not-yet-
  // committed) value at the caret and inserts a real blank-line run there,
  // then commits through the same onCommitRaw path finishEditing uses —
  // spliceRawText (RichTextEditor.tsx) re-segments on that blank line and
  // reclassifies each half independently. The coarse equivalent (right-click
  // "Split here" on a non-editing block, no caret available) lives in
  // RichTextEditor.tsx's handleContextMenu.
  function splitAtCaret(): void {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, value } = textarea
    const before = value.slice(0, selectionStart).replace(/\s+$/, '')
    const after = value.slice(selectionStart).replace(/^\s+/, '')
    if (!before || !after) return // caret at the very start/end — nothing to split off
    const pos = getPos()
    skipNextBlurRef.current = true
    setEditing(false)
    if (pos !== undefined) onCommitRaw(pos, node.nodeSize, before + '\n\n' + after)
  }

  return (
    <NodeViewWrapper className="richtext-raw-block" contentEditable={false}>
      {editing ? (
        <textarea
          ref={textareaRef}
          className="richtext-block-edit"
          defaultValue={raw}
          title="Ctrl+Enter splits this block into two at the cursor"
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              splitAtCaret()
            }
          }}
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
