// Block-based hybrid WYSIWYG mode: the page renders fully via ftml (like
// PreviewPane), but clicking a block swaps just that block for its raw
// Wikidot source; blurring re-renders it in place. Each block keeps its
// own raw text, so there's never any rendered-HTML-back-to-Wikidot
// reverse-translation — the document's canonical form stays Wikidot text
// throughout. See .scratch/wysiwyg-mode/spec.md and prototype-findings.md
// for the design rationale and known limitations (segmentation heuristic
// risk tracked separately in .scratch/wysiwyg-segmentation-hardening/spec.md).
import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { presubstitute } from '../lib/wikidot-presubstitute'
import { segment, reassemble } from '../lib/block-segment'

export interface WysiwygEditorHandle {
  insertSyntax: (before: string, after?: string) => void
}

interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

interface WysiwygEditorProps {
  source: string
  onChange: (next: string) => void
  pageInfo: PageInfoInput
}

interface InsertGapProps {
  onInsert: () => void
}

function InsertGap({ onInsert }: InsertGapProps): React.JSX.Element {
  return (
    <div className="wysiwyg-insert-gap">
      <button
        type="button"
        className="wysiwyg-insert-gap-btn"
        title="Insert a new block here"
        aria-label="Insert a new block here"
        onClick={onInsert}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

const WysiwygEditor = forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(function WysiwygEditor(
  { source, onChange, pageInfo },
  ref
) {
  const [blocks, setBlocks] = useState<string[]>(() => segment(source))
  const [html, setHtml] = useState<string[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const checkedRoundTrip = useRef(false)
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Lets the toolbar's formatting buttons (Bold, Strikethrough, etc.) wrap
  // the current selection inside whichever block is being edited, mirroring
  // Editor.tsx's CodeMirror-backed insertSyntax. Goes through execCommand
  // rather than assigning textarea.value directly — a direct assignment
  // wipes the browser's native undo stack for the field (Ctrl+Z becomes a
  // no-op after the first toolbar click), while execCommand('insertText')
  // is recorded as a normal edit so undo/redo keep working. Falls back to
  // direct assignment only if execCommand is unavailable.
  useImperativeHandle(
    ref,
    () => ({
      insertSyntax(before: string, after = '') {
        const textarea = editingTextareaRef.current
        if (!textarea) return
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
    }),
    []
  )

  // segment/reassemble is chunking, not parsing (block-segment.ts) — a
  // mismatch here would mean the heuristic silently dropped or duplicated
  // text. Logged once rather than asserted, so a bad case surfaces for
  // investigation instead of crashing the editor.
  useEffect(() => {
    if (checkedRoundTrip.current) return
    checkedRoundTrip.current = true
    const reassembled = reassemble(segment(source))
    if (reassembled !== source) {
      console.warn('WysiwygEditor: segment/reassemble round-trip mismatch on initial source', {
        original: source,
        reassembled
      })
    }
  }, [source])

  // Only resync blocks from the parent's `source` when it changed for a
  // reason other than our own onChange echoing back through App's state —
  // otherwise every edit would immediately re-segment itself mid-edit.
  useEffect(() => {
    if (source !== reassemble(blocks)) {
      setBlocks(segment(source))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      blocks.map((block) => window.api.renderWikitext(presubstitute(block), pageInfo))
    ).then((results) => {
      if (cancelled) return
      setHtml(results.map((r) => r.html))
    })
    return () => {
      cancelled = true
    }
  }, [blocks, pageInfo])

  // Shared commit path for edits/deletes: reassemble to the canonical
  // source, re-segment it fresh (an edit can change a block's own
  // boundaries — e.g. typing a blank line splits it, deleting one merges
  // adjacent text), and always leave at least one empty block so there's
  // somewhere to click even after deleting everything.
  function commitBlocks(nextBlocks: string[]): void {
    const nextSource = reassemble(nextBlocks)
    const resegmented = segment(nextSource)
    setBlocks(resegmented.length > 0 ? resegmented : [''])
    onChange(nextSource)
  }

  function startEditing(index: number): void {
    setEditingIndex(index)
  }

  // A block's own trailing blank-line separator is what keeps it distinct
  // from the next block on re-segmentation (block-segment.ts bakes each
  // block's separator into its own slice, not the following block's
  // leading edge). Typed text rarely ends with one, so without this an
  // edited/inserted block glues directly onto the next block's text on
  // commit — e.g. typing a new paragraph right before a "+ Heading" line
  // turns it into "...text.+ Heading", silently breaking the heading
  // marker (only recognized at the start of a line). Only the just-edited
  // block's whitespace is touched — every other block's text is untouched,
  // preserving round-trip fidelity for anything not actively edited.
  function ensureBlockSeparation(text: string, isLastBlock: boolean): string {
    if (text.length === 0 || isLastBlock) return text
    return /\n[ \t]*\n\s*$/.test(text) ? text : text.replace(/\s+$/, '') + '\n\n'
  }

  function finishEditing(index: number, nextText: string): void {
    const nextBlocks = blocks.slice()
    nextBlocks[index] = ensureBlockSeparation(nextText, index === nextBlocks.length - 1)
    setEditingIndex(null)
    commitBlocks(nextBlocks)
  }

  // Inserts a blank block and opens it for editing directly — deliberately
  // not committed through onChange yet, since an empty block contributes
  // nothing to the reassembled source (and segment() would just filter it
  // back out). It becomes real once the user types something and blurs,
  // via the normal finishEditing path; blurring an untouched insert is a
  // silent no-op cancel.
  function insertBlockAt(index: number): void {
    setBlocks((prevBlocks) => prevBlocks.slice(0, index).concat('', prevBlocks.slice(index)))
    setEditingIndex(index)
  }

  function deleteBlockAt(index: number): void {
    const nextBlocks = blocks.slice(0, index).concat(blocks.slice(index + 1))
    setEditingIndex((current) => {
      if (current === null || current === index) return null
      return current > index ? current - 1 : current
    })
    commitBlocks(nextBlocks)
  }

  return (
    <div className="preview-pane">
      <div className="scp-page-wrap">
        <InsertGap onInsert={() => insertBlockAt(0)} />
        {blocks.map((block, i) => (
          <Fragment key={i}>
            {editingIndex === i ? (
              <textarea
                ref={editingTextareaRef}
                className="wysiwyg-block-edit"
                defaultValue={block}
                autoFocus
                onBlur={(e) => finishEditing(i, e.target.value)}
              />
            ) : (
              <div className="wysiwyg-block-wrap">
                <button
                  type="button"
                  className="wysiwyg-block-delete"
                  title="Delete this block"
                  aria-label="Delete this block"
                  onClick={() => deleteBlockAt(i)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
                <div
                  className="wysiwyg-block"
                  title="Click to edit raw Wikidot for this block"
                  onClick={() => startEditing(i)}
                  dangerouslySetInnerHTML={{ __html: html[i] ?? '' }}
                />
              </div>
            )}
            <InsertGap onInsert={() => insertBlockAt(i + 1)} />
          </Fragment>
        ))}
      </div>
    </div>
  )
})

export default WysiwygEditor
