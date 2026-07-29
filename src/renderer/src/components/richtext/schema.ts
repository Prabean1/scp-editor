// Matches ftml's rendered tags (h1-h6/p/strong/em/u/s/sub/sup/a) so preview.css styles it for
// free, and only registers node/mark types ftml-ast.ts/wikidot-serializer.ts can walk.
import { Node, mergeAttributes, type AnyExtension } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import RawBlockView from './RawBlockView'
import type { PageInfoInput } from '../../../../shared/types'

export type { PageInfoInput }

export interface RawBlockOptions {
  // A ref (not the value) so a live PageInfoModal edit reaches already-mounted NodeViews
  // without forcing an editor rebuild.
  pageInfoRef: { current: PageInfoInput }
  // Fires on blur; RichTextEditor.tsx owns re-parsing, this just reports new raw text.
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
      // One-shot: true only right after "Raw Text" converts a rich node, so RawBlockView
      // opens in edit mode. Read once via useState's lazy initializer, not re-applied later.
      startEditing: { default: false },
      // One-shot, paired with startEditing: where to place the caret in the textarea the
      // first time it opens. Read once via a ref, not re-applied on later re-entries.
      caretOffset: { default: null }
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
      // hardBreak stays enabled: ftml renders a mid-paragraph line-wrap as a real <br>,
      // and TipTap's default Shift+Enter=hardBreak / Enter=new-paragraph already matches that.
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false
      }
    }),
    // excludes overridden so sub/sup are mutually exclusive on the same run;
    // TipTap's stock extensions only exclude self-nesting by default.
    Subscript.extend({ excludes: 'subscript superscript' }),
    Superscript.extend({ excludes: 'superscript subscript' }),
    RawBlock.configure(rawBlockOptions)
  ]
}
