import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type ChainedCommands } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { createRichTextExtensions, type PageInfoInput } from './richtext/schema'
import BlockContextMenu, { type BlockContextMenuItem } from './richtext/BlockContextMenu'
import { presubstitute } from '../lib/wikidot-presubstitute'
import { segment } from '../lib/block-segment'
import { classifyChunk, astToPmNodes, type FtmlAst, type PmNode } from '../lib/ftml-ast'
import { serializeDoc, TRAILING_BLANK_RUN_RE } from '../lib/wikidot-serializer'
import {
  CARET_MARKER,
  clientYToRawOffset,
  getTopLevelBlocks,
  joinForMerge,
  nodeRawText,
  rawTextWithCaret,
  splitRawTextAt,
  type BlockEntry
} from '../lib/richtext-blocks'
import { firstImageFile } from '../lib/image-drop'

export interface RichTextEditorHandle {
  insertSyntax: (before: string, after?: string) => void
}

interface RichTextEditorProps {
  source: string
  onChange: (next: string) => void
  pageInfo: PageInfoInput
  onDropImage: (file: File) => Promise<string | null>
}

const MARK_COMMANDS: Record<string, (chain: ChainedCommands) => ChainedCommands> = {
  '**|**': (c) => c.toggleBold(),
  '//|//': (c) => c.toggleItalic(),
  '__|__': (c) => c.toggleUnderline(),
  '--|--': (c) => c.toggleStrike(),
  ',,|,,': (c) => c.toggleSubscript(),
  '^^|^^': (c) => c.toggleSuperscript(),
  '+ |': (c) => c.setHeading({ level: 1 }),
  '++ |': (c) => c.setHeading({ level: 2 }),
  '+++ |': (c) => c.setHeading({ level: 3 }),
  '++++ |': (c) => c.setHeading({ level: 4 })
}

async function chunkToNodes(
  chunk: string,
  pageInfo: PageInfoInput,
  startEditing = false
): Promise<PmNode[]> {
  const { ast } = await window.api.parseWikitext(presubstitute(chunk), pageInfo)
  const cls = classifyChunk(ast as FtmlAst)
  if (cls === 'rich') return astToPmNodes(ast as FtmlAst)
  // Strip segment()'s trailing block-boundary blank line — serializeDoc's ensureSeparation owns
  // re-adding it; left in, a re-segment on commit reads it as a fresh split.
  const raw = chunk.replace(TRAILING_BLANK_RUN_RE, '')
  return [{ type: 'rawBlock', attrs: { raw, startEditing } }]
}

async function buildDoc(source: string, pageInfo: PageInfoInput): Promise<PmNode> {
  const chunks = await segment(source)
  const nodesPerChunk = await Promise.all(chunks.map((chunk) => chunkToNodes(chunk, pageInfo)))
  const content = nodesPerChunk.flat()
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] }
}

type CaretTarget = { kind: 'text'; pos: number } | { kind: 'raw'; offset: number }

// `kind: 'raw'` means the marker landed in a rawBlock's raw text, which has no PM position —
// the caller opens that block in edit mode with the offset instead.
function stripCaretMarker(nodes: PmNode[]): { content: PmNode[]; caret: CaretTarget | null } {
  let pos = 0
  let caret: CaretTarget | null = null

  function visit(node: PmNode): PmNode {
    if (caret) return node
    if (node.type === 'text') {
      const idx = node.text?.indexOf(CARET_MARKER) ?? -1
      if (idx === -1) {
        pos += node.text?.length ?? 0
        return node
      }
      const text = node.text as string
      const stripped = text.slice(0, idx) + text.slice(idx + CARET_MARKER.length)
      caret = { kind: 'text', pos: pos + idx }
      return { ...node, text: stripped }
    }
    if (!node.content) {
      pos += 1
      return node
    }
    pos += 1
    // Stripping the marker can leave an empty '' text node (e.g. an unrecognized external-link
    // URL tokenized as its own run) — ProseMirror rejects those outright, so drop it.
    const content = node.content.map(visit).filter((n) => !(n.type === 'text' && n.text === ''))
    pos += 1
    return { ...node, content }
  }

  const content = nodes.map((node) => {
    if (!caret && node.type === 'rawBlock' && typeof node.attrs?.raw === 'string') {
      const raw = node.attrs.raw as string
      const idx = raw.indexOf(CARET_MARKER)
      if (idx !== -1) {
        caret = { kind: 'raw', offset: idx }
        return {
          ...node,
          attrs: {
            ...node.attrs,
            raw: raw.slice(0, idx) + raw.slice(idx + CARET_MARKER.length),
            startEditing: true,
            caretOffset: idx
          }
        }
      }
    }
    return caret ? node : visit(node)
  })

  return { content, caret }
}

function insertIntoTextarea(textarea: HTMLTextAreaElement, before: string, after: string): void {
  textarea.focus()
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd)
  const insertText = before + selected + after
  const cursor = selectionStart + before.length + selected.length
  let inserted = false
  try {
    inserted = document.execCommand('insertText', false, insertText)
  } catch {
    inserted = false
  }
  if (!inserted) {
    textarea.value = value.slice(0, selectionStart) + insertText + value.slice(selectionEnd)
  }
  textarea.setSelectionRange(cursor, cursor)
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ source, onChange, pageInfo, onDropImage }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const pageInfoRef = useRef(pageInfo)
    const onChangeRef = useRef(onChange)
    const [contextMenu, setContextMenu] = useState<{
      x: number
      y: number
      items: BlockContextMenuItem[]
    } | null>(null)

    useEffect(() => {
      pageInfoRef.current = pageInfo
    }, [pageInfo])
    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    const onDropImageRef = useRef(onDropImage)
    useEffect(() => {
      onDropImageRef.current = onDropImage
    }, [onDropImage])

    const commitRawRef = useRef<(pos: number, nodeSize: number, rawText: string) => void>(() => {})
    // True mid-rebuild: the doc is stale/bootstrap, so an edit landing in it must not overwrite App's source.
    const rebuildPendingRef = useRef(false)
    const extensions = useMemo(
      () =>
        createRichTextExtensions({
          pageInfoRef,
          onCommitRaw: (pos, nodeSize, rawText) => commitRawRef.current(pos, nodeSize, rawText)
        }),
      []
    )

    // Images always classify as rawBlock (only headers/paragraphs are rich-eligible), so a
    // dropped/pasted image's `[[image local:<id>]]` marker goes through the normal chunk pipeline.
    async function insertImageAt(view: EditorView, pos: number, file: File): Promise<void> {
      const marker = await onDropImageRef.current(file)
      if (!marker) return
      const nodes = await chunkToNodes(marker, pageInfoRef.current)
      const pmNodes = nodes.map((n) => view.state.schema.nodeFromJSON(n))
      view.dispatch(view.state.tr.insert(pos, pmNodes))
    }

    const editor = useEditor({
      extensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      onUpdate: ({ editor: e }) => {
        if (rebuildPendingRef.current) return
        onChangeRef.current(serializeDoc(e.getJSON() as PmNode))
      },
      editorProps: {
        handleDrop(view, event) {
          const file = firstImageFile(Array.from(event.dataTransfer?.files ?? []))
          if (!file) return false
          event.preventDefault()
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          const pos = coords?.pos ?? view.state.doc.content.size
          insertImageAt(view, pos, file)
          return true
        },
        handlePaste(view, event) {
          const files = Array.from(event.clipboardData?.items ?? [])
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null)
          const file = firstImageFile(files)
          if (!file) return false
          event.preventDefault()
          insertImageAt(view, view.state.selection.from, file)
          return true
        }
      }
    })

    // Re-segments/reclassifies rawText before splicing over [from, to); skipHistory drops that
    // reclassify's undo entry when a blur-commit didn't actually change the text.
    async function spliceRawText(
      from: number,
      to: number,
      rawText: string,
      skipHistory = false
    ): Promise<void> {
      if (!editor) return
      const chunks = await segment(rawText)
      const nodesPerChunk = await Promise.all(
        chunks.map((chunk) => chunkToNodes(chunk, pageInfoRef.current))
      )
      const content = nodesPerChunk.flat()
      const chain = editor.chain().focus().insertContentAt({ from, to }, content)
      if (skipHistory) chain.setMeta('addToHistory', false)
      chain.run()
    }

    // insertContentAt's post-insert selection can span the whole inserted range instead of
    // collapsing between before/after — see CARET_MARKER/stripCaretMarker.
    async function spliceRawTextWithCaret(
      from: number,
      to: number,
      before: string,
      after: string
    ): Promise<void> {
      if (!editor) return
      // Fold the enclosing rich block's text into before/after and replace the whole block —
      // a point-insert at the inline position tears the block in three instead.
      const enclosing = getTopLevelBlocks(editor.state.doc).find(
        (b) => b.from <= from && to <= b.to
      )
      let insertFrom = from
      let insertTo = to
      let fullBefore = before
      let fullAfter = after
      // An atom (rawBlock) has no inline PM content to fold in — its own merge/split paths
      // handle that case; only a rich (paragraph/heading) enclosing block needs folding.
      if (enclosing !== undefined && !enclosing.node.isAtom) {
        const { raw, offset } = rawTextWithCaret(enclosing.node, from - enclosing.from - 1)
        fullBefore = raw.slice(0, offset) + before
        fullAfter = after + raw.slice(offset)
        insertFrom = enclosing.from
        insertTo = enclosing.to
      }

      // Blocks keystrokes during the async ftml round-trip so they can't land against a stale
      // from/to; setEditable alone can lose a same-tick race, hence the listener backup.
      editor.setEditable(false)
      const dom = editor.view.dom
      const blockInput = (e: Event): void => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
      dom.addEventListener('beforeinput', blockInput, true)
      let stripped: ReturnType<typeof stripCaretMarker>
      try {
        const chunks = await segment(fullBefore + CARET_MARKER + fullAfter)
        const nodesPerChunk = await Promise.all(
          chunks.map((chunk) => chunkToNodes(chunk, pageInfoRef.current))
        )
        stripped = stripCaretMarker(nodesPerChunk.flat())
      } finally {
        dom.removeEventListener('beforeinput', blockInput, true)
        editor.setEditable(true)
      }
      // A link's URL becomes a mark attribute, not visible PM text, so the marker never reaches
      // a text node — fall back to a raw block (like Image) where the caret has somewhere real to go.
      let content: PmNode[]
      let caret: CaretTarget
      if (stripped.caret === null) {
        content = [
          {
            type: 'rawBlock',
            attrs: {
              raw: fullBefore + fullAfter,
              startEditing: true,
              caretOffset: fullBefore.length
            }
          }
        ]
        caret = { kind: 'raw', offset: fullBefore.length }
      } else {
        content = stripped.content
        caret = stripped.caret
      }
      const chain = editor
        .chain()
        .focus()
        .insertContentAt({ from: insertFrom, to: insertTo }, content)
      if (caret.kind === 'text') chain.setTextSelection(insertFrom + caret.pos)
      chain.run()
    }

    commitRawRef.current = (pos, nodeSize, rawText) => {
      // A blur always reclassifies, even with unchanged text — skip that reclassify's history
      // entry so it doesn't cost a second undo on top of whatever put this block here.
      const current = editor?.state.doc.nodeAt(pos)
      const unchanged = current?.type.name === 'rawBlock' && current.attrs.raw === rawText
      spliceRawText(pos, pos + nodeSize, rawText, unchanged)
    }

    // Merging a paragraph into a heading is a no-op by construction — ftml still parses
    // '+ Heading' as its own block after the join — so no special-casing is needed here.
    function mergeBlocks(above: BlockEntry, below: BlockEntry): void {
      const joined = joinForMerge(nodeRawText(above.node), nodeRawText(below.node))
      spliceRawText(above.from, below.to, joined)
    }

    // A non-editing raw block has no real caret, so this maps click position to a proportional
    // offset into the raw text, snapped to the nearest newline (RawBlockView's Ctrl+Enter is the precise equivalent).
    function coarseSplitRawBlock(entry: BlockEntry, clientY: number, blockEl: HTMLElement): void {
      const raw = nodeRawText(entry.node)
      const rect = blockEl.getBoundingClientRect()
      const offset = clientYToRawOffset(raw, clientY, rect.top, rect.height)
      const split = splitRawTextAt(raw, offset)
      if (!split) return
      spliceRawText(entry.from, entry.to, split.before + '\n\n' + split.after)
    }

    // Rebuilds only when `source` changes for a reason other than our own onUpdate echoing
    // back. Rebuilding loses undo history/cursor, but never document text.
    useEffect(() => {
      if (!editor) return
      if (source === serializeDoc(editor.getJSON() as PmNode)) return
      let cancelled = false
      rebuildPendingRef.current = true
      buildDoc(source, pageInfoRef.current).then((doc) => {
        if (cancelled || editor.isDestroyed) {
          rebuildPendingRef.current = false
          return
        }
        editor.commands.setContent(doc, { emitUpdate: false })
        rebuildPendingRef.current = false
      })
      return () => {
        cancelled = true
      }
    }, [source, editor])

    useImperativeHandle(
      ref,
      () => ({
        insertSyntax(before: string, after = '') {
          const active = document.activeElement
          if (active instanceof HTMLTextAreaElement && rootRef.current?.contains(active)) {
            insertIntoTextarea(active, before, after)
            return
          }
          if (!editor) return
          const command = MARK_COMMANDS[`${before}|${after}`]
          if (command) {
            command(editor.chain().focus()).run()
            return
          }
          // A collapsed selection is an empty wrap, needing the caret placed inside the
          // inserted markup rather than trusting insertContentAt's own selection.
          const { from, to } = editor.state.selection
          const selected = editor.state.doc.textBetween(from, to, '\n\n')
          if (selected === '') {
            spliceRawTextWithCaret(from, to, before, after)
          } else {
            spliceRawText(from, to, before + selected + after)
          }
        }
      }),
      // spliceRawText isn't memoized; adding it here would re-run this hook every render for no benefit.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [editor]
    )

    function handleContextMenu(e: React.MouseEvent): void {
      if (!editor) return
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
      if (!coords) return
      // posAtCoords on an atom NodeView (rawBlock) can resolve to depth-0, so use position-range
      // containment instead of $pos.node(1).
      const blocks = getTopLevelBlocks(editor.state.doc)
      // Half-open [from, to): an inclusive upper bound matched the previous block for clicks near
      // a boundary; the last block needs the index fallback since nothing follows it.
      const entry = blocks.find(
        (b) => coords.pos >= b.from && (coords.pos < b.to || b.index === blocks.length - 1)
      )
      if (!entry) return
      const topNode = entry.node
      const isRich = topNode.type.name === 'heading' || topNode.type.name === 'paragraph'
      const isRawBlock = topNode.type.name === 'rawBlock'
      if (!isRich && !isRawBlock) return
      e.preventDefault()
      const targetEl = (e.target as HTMLElement | null)?.closest(
        '.richtext-raw-block, .richtext-block'
      ) as HTMLElement | null
      const clientY = e.clientY

      const items: BlockContextMenuItem[] = []
      if (isRich) {
        items.push({
          label: 'Raw Text',
          onSelect: () => {
            const rawText = serializeDoc({ type: 'doc', content: [topNode.toJSON() as PmNode] })
            editor
              .chain()
              .focus()
              .insertContentAt(
                { from: entry.from, to: entry.to },
                { type: 'rawBlock', attrs: { raw: rawText, startEditing: true } }
              )
              .run()
          }
        })
      }
      if (entry.index > 0) {
        items.push({
          label: 'Merge with block above',
          onSelect: () => mergeBlocks(blocks[entry.index - 1], entry)
        })
      }
      if (entry.index < blocks.length - 1) {
        items.push({
          label: 'Merge with block below',
          onSelect: () => mergeBlocks(entry, blocks[entry.index + 1])
        })
      }
      if (isRawBlock && targetEl) {
        items.push({
          label: 'Split here',
          onSelect: () => coarseSplitRawBlock(entry, clientY, targetEl)
        })
      }
      if (items.length === 0) return
      setContextMenu({ x: e.clientX, y: e.clientY, items })
    }

    return (
      <div className="preview-pane" ref={rootRef}>
        <div className="scp-page-wrap" onContextMenu={handleContextMenu}>
          <EditorContent editor={editor} />
        </div>
        {contextMenu && (
          <BlockContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    )
  }
)

export default RichTextEditor
