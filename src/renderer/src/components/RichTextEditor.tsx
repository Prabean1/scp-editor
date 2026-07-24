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
import { EditorContent, useEditor, type ChainedCommands, type Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
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
  '^^|^^': (c) => c.toggleSuperscript(),
  // Toolbar.tsx's HEADING_MAP passes these with no `after`, matching the
  // '+ ' / '++ ' / etc. Wikidot heading prefixes. Headings round-trip through
  // ftml-ast.ts/wikidot-serializer.ts like any other rich node, so — unlike
  // the block-level Insert-tab syntax below, which has no schema support at
  // all — this is real functionality, not just a no-op-hiding UX fix.
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

interface BlockEntry {
  node: PMNode
  from: number
  to: number
  index: number
}

// One entry per top-level node (heading/paragraph/rawBlock) — the doc's own
// "blocks" from the manual merge/split feature's point of view. Rebuilt
// fresh on every context-menu open rather than cached, since the doc
// changes on every edit.
function getTopLevelBlocks(editor: Editor): BlockEntry[] {
  const blocks: BlockEntry[] = []
  editor.state.doc.forEach((node, offset, index) => {
    blocks.push({ node, from: offset, to: offset + node.nodeSize, index })
  })
  return blocks
}

// rawBlock's own `raw` attr is already Wikidot text (verbatim source
// slice); a rich node has to go through the same serializer the "Raw Text"
// escape hatch already uses.
function nodeRawText(node: PMNode): string {
  if (node.type.name === 'rawBlock') return (node.attrs.raw as string) ?? ''
  return serializeDoc({ type: 'doc', content: [node.toJSON() as PmNode] })
}

// Merge's junction: exactly one '\n', never a blank-line run. A rawBlock's
// `raw` text is a verbatim segment() slice, which (per
// wikidot-serializer.ts's ensureSeparation) usually *ends* in its own
// blank-line run when it wasn't the doc's last block — left alone, that
// blank line would make segment() (called by spliceRawText below) re-split
// the merge right back into two chunks, silently no-op'ing the merge.
function joinForMerge(rawA: string, rawB: string): string {
  return rawA.replace(/\s+$/, '') + '\n' + rawB.replace(/^\s+/, '')
}

// Splits `text` at `offset`, snapped to the nearest newline so a coarse
// (click-position-based) split never lands mid-line. Falls back to the
// unsnapped offset if the text has no newline at all.
function snapToNearestNewline(text: string, offset: number): number {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\n') continue
    const dist = Math.abs(i - offset)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best === -1 ? offset : best + 1
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

    // Shared splice primitive: re-segment `rawText` (it may contain internal
    // blank-line runs — segment() picks them up) and reclassify each
    // resulting chunk, then splice the whole reclassified list over
    // [from, to). Both a single-block raw-text commit (one chunk in, one or
    // more nodes out) and manual merge/split (built from two blocks' worth
    // of text, or one block's text with a manual blank-line/junction
    // inserted) are the exact same operation at this level — only how the
    // caller composes `rawText` differs.
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

    // Merging grammatically-distinct blocks (e.g. a paragraph and a
    // heading) is effectively a no-op: joined with a single '\n', ftml
    // still parses '+ Heading' as its own block, so classifyChunk/
    // astToPmNodes yields two nodes again and the splice below just
    // restores both. Correct behavior (you can't fold a heading into a
    // paragraph), not worth special-casing.
    function mergeBlocks(above: BlockEntry, below: BlockEntry): void {
      const joined = joinForMerge(nodeRawText(above.node), nodeRawText(below.node))
      spliceRawText(above.from, below.to, joined)
    }

    // Coarse split: no real caret exists on a non-editing raw block (it
    // renders HTML, not the raw textarea), so this maps the click's
    // vertical position within the block's own bounding box to a
    // proportional offset into the raw text, snapped to the nearest
    // newline. RawBlockView's own Ctrl+Enter split (while actually editing)
    // is the precise equivalent of this same operation.
    function coarseSplitRawBlock(entry: BlockEntry, clientY: number, blockEl: HTMLElement): void {
      const raw = nodeRawText(entry.node)
      const rect = blockEl.getBoundingClientRect()
      const fraction = rect.height > 0 ? Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)) : 0.5
      const offset = snapToNearestNewline(raw, Math.round(raw.length * fraction))
      if (offset <= 0 || offset >= raw.length) return
      const before = raw.slice(0, offset).replace(/\s+$/, '')
      const after = raw.slice(offset).replace(/^\s+/, '')
      if (!before || !after) return
      spliceRawText(entry.from, entry.to, before + '\n\n' + after)
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
      // Position-range containment rather than $pos.node(1): posAtCoords on
      // an atom NodeView (rawBlock) can resolve to a boundary position whose
      // resolved depth is only 0, which node(1) can't answer — but the block
      // list built for merge below already gives an unambiguous "which
      // top-level block was this click inside" answer for every node type.
      const blocks = getTopLevelBlocks(editor)
      // Half-open [from, to) on purpose: adjacent top-level nodes share a
      // boundary position (prev.to === next.from), which atom nodes in
      // particular resolve to often — they have no real "interior"
      // position, so posAtCoords maps most of their rendered area to just
      // that one shared boundary value. An inclusive upper bound made that
      // position match BOTH neighbors, and .find() silently picked the
      // earlier (wrong) one — confirmed empirically: clicking near the top
      // of a block could open the *previous* block's context menu. The
      // last block's own `to` (the very end of the doc) needs the
      // fallback since nothing follows it to claim that boundary instead.
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
