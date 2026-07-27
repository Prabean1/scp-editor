import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type ChainedCommands } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { createRichTextExtensions, type PageInfoInput } from './richtext/schema'
import BlockContextMenu, { type BlockContextMenuItem } from './richtext/BlockContextMenu'
import { presubstitute } from '../lib/wikidot-presubstitute'
import { segment } from '../lib/block-segment'
import { classifyChunk, astToPmNodes, type FtmlAst, type PmNode } from '../lib/ftml-ast'
import { serializeDoc } from '../lib/wikidot-serializer'
import {
  clientYToRawOffset,
  getTopLevelBlocks,
  joinForMerge,
  nodeRawText,
  splitRawTextAt,
  type BlockEntry
} from '../lib/richtext-blocks'

export interface RichTextEditorHandle {
  insertSyntax: (before: string, after?: string) => void
}

interface RichTextEditorProps {
  source: string
  onChange: (next: string) => void
  pageInfo: PageInfoInput
  onDropImage: (file: File) => Promise<string | null>
}

function firstImageFile(files: File[]): File | null {
  return files.find((file) => file.type.startsWith('image/')) ?? null
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
  return [{ type: 'rawBlock', attrs: { raw: chunk, startEditing } }]
}

async function buildDoc(source: string, pageInfo: PageInfoInput): Promise<PmNode> {
  const chunks = segment(source)
  const nodesPerChunk = await Promise.all(chunks.map((chunk) => chunkToNodes(chunk, pageInfo)))
  const content = nodesPerChunk.flat()
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] }
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
    const extensions = useMemo(
      () =>
        createRichTextExtensions({
          pageInfoRef,
          onCommitRaw: (pos, nodeSize, rawText) => commitRawRef.current(pos, nodeSize, rawText)
        }),
      []
    )

    // Images always classify as a rawBlock (see classifyChunk in ftml-ast.ts —
    // only headers/paragraphs are rich-eligible), so a dropped/pasted image
    // is saved to disk for its `[[image local:<id>]]` marker, then that
    // marker is parsed through the normal chunk pipeline like any raw text
    // splice rather than built as a bespoke node.
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

    // Re-segments `rawText` (may contain internal blank-line runs) and
    // reclassifies each chunk before splicing over [from, to). A raw-text
    // commit and a manual merge/split are the same operation here — only
    // how the caller composes `rawText` differs.
    async function spliceRawText(from: number, to: number, rawText: string): Promise<void> {
      if (!editor) return
      const chunks = segment(rawText)
      const nodesPerChunk = await Promise.all(
        chunks.map((chunk) => chunkToNodes(chunk, pageInfoRef.current))
      )
      const content = nodesPerChunk.flat()
      editor.chain().focus().insertContentAt({ from, to }, content).run()
    }

    commitRawRef.current = (pos, nodeSize, rawText) => {
      spliceRawText(pos, pos + nodeSize, rawText)
    }

    // Merging a paragraph into a heading (etc.) is a no-op by construction:
    // ftml still parses '+ Heading' as its own block after the join, so the
    // splice below just restores both — not worth special-casing.
    function mergeBlocks(above: BlockEntry, below: BlockEntry): void {
      const joined = joinForMerge(nodeRawText(above.node), nodeRawText(below.node))
      spliceRawText(above.from, below.to, joined)
    }

    // Coarse split: a non-editing raw block renders HTML (no real caret),
    // so this maps the click's vertical position in the block to a
    // proportional offset into the raw text, snapped to the nearest
    // newline. RawBlockView's Ctrl+Enter split is the precise equivalent.
    function coarseSplitRawBlock(entry: BlockEntry, clientY: number, blockEl: HTMLElement): void {
      const raw = nodeRawText(entry.node)
      const rect = blockEl.getBoundingClientRect()
      const offset = clientYToRawOffset(raw, clientY, rect.top, rect.height)
      const split = splitRawTextAt(raw, offset)
      if (!split) return
      spliceRawText(entry.from, entry.to, split.before + '\n\n' + split.after)
    }

    // Rebuilds only when `source` changes for a reason other than our own
    // onUpdate echoing back (mirrors v1's echo-avoidance). Rebuilding loses
    // undo history/cursor — a known v2 limitation; document text itself is
    // never at risk.
    useEffect(() => {
      if (!editor) return
      if (source === serializeDoc(editor.getJSON() as PmNode)) return
      let cancelled = false
      buildDoc(source, pageInfoRef.current).then((doc) => {
        if (cancelled || editor.isDestroyed) return
        editor.commands.setContent(doc, { emitUpdate: false })
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
          if (command) command(editor.chain().focus()).run()
        }
      }),
      [editor]
    )

    function handleContextMenu(e: React.MouseEvent): void {
      if (!editor) return
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
      if (!coords) return
      // Position-range containment, not $pos.node(1): posAtCoords on an atom
      // NodeView (rawBlock) can resolve to depth-0, which node(1) can't
      // answer.
      const blocks = getTopLevelBlocks(editor.state.doc)
      // Half-open [from, to) on purpose: adjacent nodes share a boundary
      // position, and atom nodes especially resolve most of their clicked
      // area to that one value. An inclusive upper bound matched both
      // neighbors and .find() silently picked the wrong (earlier) one —
      // confirmed empirically via clicks near a block's top opening the
      // *previous* block's menu. The last block needs the index fallback
      // since nothing follows it to claim that boundary.
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
