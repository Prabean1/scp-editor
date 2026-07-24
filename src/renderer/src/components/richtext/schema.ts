// TipTap schema for Rich Text v2. Nodes/marks are TipTap's own stock
// extensions wherever possible, deliberately configured to a) match ftml's
// actual rendered tags (h1-h6/p/strong/em/u/s/sub/sup/a — confirmed against
// resources/ftml-pkg, no custom classes needed) so assets/preview.css styles
// this surface for free, and b) only register node/mark types
// ftml-ast.ts/wikidot-serializer.ts actually know how to walk and serialize
// — anything StarterKit offers that those two files don't handle (lists,
// blockquote, code, horizontal rule, hard breaks) is disabled here, not left
// for the user to create content the serializer can't turn back into
// Wikidot text.
import { Node, mergeAttributes, type AnyExtension } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import RawBlockView from './RawBlockView'

export interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

export interface RawBlockOptions {
  // A ref (not the value) so a live PageInfoModal edit is visible to
  // already-mounted NodeViews without forcing an editor rebuild.
  pageInfoRef: { current: PageInfoInput }
  // Called when a raw-island (or a rich block temporarily dropped into Raw
  // Text view) is edited and blurred — RichTextEditor.tsx owns re-parsing
  // and splicing the result back into the document; RawBlockView.tsx only
  // ever reports "here's the new raw text for the node at this position."
  onCommitRaw: (pos: number, nodeSize: number, rawText: string) => void
}

export const RawBlock = Node.create<RawBlockOptions>({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      pageInfoRef: { current: null as unknown as PageInfoInput },
      onCommitRaw: () => {}
    }
  },

  addAttributes() {
    return {
      raw: { default: '' },
      // One-shot: true only right after the right-click "Raw Text" escape
      // hatch converts a rich node into a rawBlock, so RawBlockView opens
      // straight into its textarea instead of requiring a second click.
      // Read once via useState's lazy initializer, not re-applied on
      // subsequent attrs changes.
      startEditing: { default: false }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-raw-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-raw-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(RawBlockView)
  }
})

export function createRichTextExtensions(rawBlockOptions: RawBlockOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      // Kept enabled (unlike the other disabled extensions above): ftml
      // renders a mid-paragraph line-wrap as a real <br> (confirmed against
      // resources/ftml-pkg, not just collapsed whitespace), and hand-wrapped
      // paragraphs are the overwhelming norm in real SCP article source —
      // see ftml-ast.ts's 'line-break' handling. TipTap's default binding
      // (Shift+Enter = hardBreak, plain Enter = new paragraph) already
      // matches Wikidot's actual blank-line-vs-single-newline semantics.
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false
      }
    }),
    Subscript,
    Superscript,
    RawBlock.configure(rawBlockOptions)
  ]
}
