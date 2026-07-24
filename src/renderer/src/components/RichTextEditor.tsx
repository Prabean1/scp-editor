// Rich Text v2: the page is a real editable TipTap document, built once
// from ftml's own AST (lib/ftml-ast.ts) and serialized back to Wikidot text
// on every change (lib/wikidot-serializer.ts) — see
// .scratch/rich-text-inline-editing/spec.md for why this replaced v1's
// click-a-block-to-see-raw-text model. block-segment.ts's segment()/
// reassemble() is still the chunking boundary: each chunk is independently
// classified as rich-editable or a raw island (components/richtext/
// RawBlockView.tsx), so anything the serializer can't losslessly
// reconstruct never gets offered as "rendered" in the first place.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type ChainedCommands } from '@tiptap/react'
import { createRichTextExtensions, type PageInfoInput } from './richtext/schema'
import BlockContextMenu, { type BlockContextMenuItem } from './richtext/BlockContextMenu'
import { presubstitute } from '../lib/wikidot-presubstitute'
import { segment } from '../lib/block-segment'
import { classifyChunk, astToPmNodes, type FtmlAst, type PmNode } from '../lib/ftml-ast'
import { serializeDoc } from '../lib/wikidot-serializer'

export interface RichTextEditorHandle {
  insertSyntax: (before: string, after?: string) => void
}

interface RichTextEditorProps {
  source: string
  onChange: (next: string) => void
  pageInfo: PageInfoInput
}

// Maps the toolbar's (before, after) syntax-marker pairs (App.tsx's
// homeButtons) to TipTap toggle commands, for when focus is inside a rich
// node. Buttons with no rich-mode destination — tables, lists, images,
// block-level snippets, anything the schema doesn't have a node/mark for —
// are a deliberate no-op here; they only apply inside an open Raw Text view
// or in Edit/Split mode.
const MARK_COMMANDS: Record<string, (chain: ChainedCommands) => ChainedCommands> = {
  '**|**': (c) => c.toggleBold(),
  '//|//': (c) => c.toggleItalic(),
  '__|__': (c) => c.toggleUnderline(),
  '--|--': (c) => c.toggleStrike(),
  ',,|,,': (c) => c.toggleSubscript(),
  '^^|^^': (c) => c.toggleSuperscript()
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
  function RichTextEditor({ source, onChange, pageInfo }, ref) {
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

    // commitRawRef/schema options must stay referentially stable across
    // renders — createRichTextExtensions() only runs once (useMemo, empty
    // deps) since re-running it would hand TipTap a brand-new RawBlock
    // extension instance and tear down/rebuild the whole editor on every
    // render. The ref indirection lets the *behavior* stay current (latest
    // editor/pageInfo) without that.
    const commitRawRef = useRef<(pos: number, nodeSize: number, rawText: string) => void>(() => {})
    const extensions = useMemo(
      () =>
        createRichTextExtensions({
          pageInfoRef,
          onCommitRaw: (pos, nodeSize, rawText) => commitRawRef.current(pos, nodeSize, rawText)
        }),
      []
    )

    const editor = useEditor({
      extensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      onUpdate: ({ editor: e }) => {
        onChangeRef.current(serializeDoc(e.getJSON() as PmNode))
      }
    })

    commitRawRef.current = async (pos, nodeSize, rawText) => {
      if (!editor) return
      const chunks = segment(rawText)
      const nodesPerChunk = await Promise.all(
        chunks.map((chunk) => chunkToNodes(chunk, pageInfoRef.current))
      )
      const content = nodesPerChunk.flat()
      editor
        .chain()
        .focus()
        .insertContentAt({ from: pos, to: pos + nodeSize }, content)
        .run()
    }

    // Rebuild whenever `source` changes for a reason other than our own
    // onUpdate echoing back through App's state (mirrors v1's exact
    // echo-avoidance) — e.g. an edit made in Split mode while Rich Text was
    // unmounted, or switching into Rich Text mode for the first time. Per
    // the design session: rebuilding loses this editor's undo history/cursor,
    // accepted as a documented v2 limitation (the document text itself is
    // never at risk — it always comes back from `source`).
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
      const $pos = editor.state.doc.resolve(coords.pos)
      const topNode = $pos.node(1)
      if (!topNode || (topNode.type.name !== 'heading' && topNode.type.name !== 'paragraph')) return
      e.preventDefault()
      const topPos = $pos.before(1)
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: 'Raw Text',
            onSelect: () => {
              const rawText = serializeDoc({ type: 'doc', content: [topNode.toJSON() as PmNode] })
              editor
                .chain()
                .focus()
                .insertContentAt(
                  { from: topPos, to: topPos + topNode.nodeSize },
                  { type: 'rawBlock', attrs: { raw: rawText, startEditing: true } }
                )
                .run()
            }
          }
        ]
      })
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
