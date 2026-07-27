import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { presubstitute } from '../../lib/wikidot-presubstitute'
import { splitRawTextAt } from '../../lib/richtext-blocks'
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
  // Removing a focused element fires a synchronous Chromium blur, which would otherwise
  // re-enter finishEditing with the stale pre-split value right after splitAtCaret commits.
  const skipNextBlurRef = useRef(false)

  // Not `autoFocus`: ProseMirror re-asserts focus on its contentEditable root during the same
  // mousedown that opens this textarea, stealing it back and firing onBlur immediately.
  // Focusing one frame later lets that finish first.
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
    // Always reclassifies on blur, even if nextText === raw — turning a rich node dropped
    // into Raw Text view back into a rich node only happens inside onCommitRaw.
    if (pos !== undefined) onCommitRaw(pos, node.nodeSize, nextText)
  }

  // Cuts the textarea's uncommitted value at the caret and commits via onCommitRaw, same as
  // finishEditing. Coarse equivalent (no caret available) lives in RichTextEditor's handleContextMenu.
  function splitAtCaret(): void {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, value } = textarea
    const split = splitRawTextAt(value, selectionStart)
    if (!split) return // caret at the very start/end — nothing to split off
    const pos = getPos()
    skipNextBlurRef.current = true
    setEditing(false)
    if (pos !== undefined) onCommitRaw(pos, node.nodeSize, split.before + '\n\n' + split.after)
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
          // Not onClick: ProseMirror's mousedown handling for atom+selectable nodes swallows
          // the click before a `click` event fires. `button === 0` excludes right-click, which
          // should only open the context menu, not also enter edit mode.
          onMouseDown={(e) => {
            if (e.button === 0) setEditing(true)
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  )
}
