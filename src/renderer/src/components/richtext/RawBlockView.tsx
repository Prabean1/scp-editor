import { useEffect, useMemo, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { presubstitute } from '../../lib/wikidot-presubstitute'
import { countFootnotes, renumberFootnotes, suppressBlockFootnoteList } from '../../lib/block-render'
import { getTopLevelBlocks, nodeRawText, splitRawTextAt } from '../../lib/richtext-blocks'
import type { PageInfoInput } from './schema'

export default function RawBlockView({
  node,
  getPos,
  extension,
  editor
}: NodeViewProps): React.JSX.Element {
  const raw = node.attrs.raw as string
  const { pageInfoRef, onCommitRaw } = extension.options as {
    pageInfoRef: { current: PageInfoInput }
    onCommitRaw: (pos: number, nodeSize: number, rawText: string) => void
  }
  const [editing, setEditing] = useState(Boolean(node.attrs.startEditing))
  // Unshifted html from ftml, which numbers footnotes as if this block were the whole
  // document — footnoteOffset (below) corrects that before it reaches the DOM.
  const [baseHtml, setBaseHtml] = useState('')
  const [footnoteOffset, setFootnoteOffset] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // Removing a focused element fires a synchronous Chromium blur, which would otherwise
  // re-enter finishEditing with the stale pre-split value right after splitAtCaret commits.
  const skipNextBlurRef = useRef(false)

  // Not `autoFocus`: ProseMirror re-asserts focus on its contentEditable root on the same
  // mousedown, stealing it back; focusing one frame later avoids that race.
  useEffect(() => {
    if (!editing) return
    const raf = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [editing])

  useEffect(() => {
    if (editing) return
    let cancelled = false
    window.api
      .renderWikitext(presubstitute(suppressBlockFootnoteList(raw)), pageInfoRef.current)
      .then((result) => {
        if (!cancelled) setBaseHtml(result.html)
      })
    return () => {
      cancelled = true
    }
  }, [raw, editing, pageInfoRef])

  // Every other raw block is a sibling NodeView, so an edit there doesn't re-render this
  // one — recompute how many footnotes precede this block whenever the doc changes.
  useEffect(() => {
    if (editing) return
    function recomputeOffset(): void {
      const pos = getPos()
      if (pos === undefined) return
      const offset = getTopLevelBlocks(editor.state.doc)
        .filter((block) => block.to <= pos)
        .reduce((total, block) => total + countFootnotes(nodeRawText(block.node)), 0)
      setFootnoteOffset(offset)
    }
    recomputeOffset()
    editor.on('update', recomputeOffset)
    return () => {
      editor.off('update', recomputeOffset)
    }
  }, [editing, editor, getPos])

  const html = useMemo(
    () => renumberFootnotes(baseHtml, footnoteOffset),
    [baseHtml, footnoteOffset]
  )

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

  // Coarse equivalent lives in RichTextEditor's handleContextMenu (no caret available there).
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
          // Not onClick: ProseMirror's mousedown handling for atom+selectable nodes swallows the
          // click event before it fires; button === 0 excludes right-click (context-menu only).
          onMouseDown={(e) => {
            if (e.button === 0) setEditing(true)
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  )
}
