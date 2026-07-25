import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { isInsideLiteralBody, maskInlineEscapes } from './unclosed-tags'

// Wikidot uses literal straight " structurally (e.g. param="value") — curling
// it there would corrupt the tag. Both checks below only look backward from
// the cursor, which keeps them correct while a tag is still being typed, not
// just once it's complete.

// ']' and '}' precede a fresh quote with no space, e.g. [[div]]"quoted" —
// that quote should open, not close.
const OPEN_PUNCT = new Set(['(', '[', '{', ']', '}'])

const CURLY: Record<string, { open: string; close: string }> = {
  '"': { open: '“', close: '”' },
  "'": { open: '‘', close: '’' }
}

function isInsideTagBrackets(maskedTextBefore: string): boolean {
  const lastOpen = maskedTextBefore.lastIndexOf('[[')
  const lastClose = maskedTextBefore.lastIndexOf(']]')
  return lastOpen > lastClose
}

// @@...@@ escapes forbid newlines (see unclosed-tags.ts's INLINE_ESCAPE_RE),
// so an odd number of "@@" tokens since the start of the line means the
// cursor sits inside a still-open escape — quotes typed there should stay
// straight, matching the eventual rendered-verbatim text.
function isInsideInlineEscape(lineTextBefore: string): boolean {
  const tokens = lineTextBefore.match(/@@/g)
  return tokens !== null && tokens.length % 2 === 1
}

function handleInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (from !== to) return false
  if (text !== '"' && text !== "'") return false

  const line = view.state.doc.lineAt(from)
  if (isInsideInlineEscape(view.state.sliceDoc(line.from, from))) return false

  const maskedDoc = maskInlineEscapes(view.state.doc.toString())
  if (isInsideTagBrackets(maskedDoc.slice(0, from))) return false
  if (isInsideLiteralBody(maskedDoc, from)) return false

  const textBefore = view.state.sliceDoc(0, from)
  const prevChar = textBefore.slice(-1)
  const isOpen = prevChar === '' || /\s/.test(prevChar) || OPEN_PUNCT.has(prevChar)
  const curly = isOpen ? CURLY[text].open : CURLY[text].close

  view.dispatch({
    changes: { from, insert: curly },
    selection: { anchor: from + curly.length }
  })
  return true
}

export function smartQuotes(): Extension {
  return Prec.high(EditorView.inputHandler.of(handleInput))
}
