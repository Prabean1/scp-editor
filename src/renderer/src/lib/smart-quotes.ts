import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { isInsideLiteralBody } from './unclosed-tags'

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

function isInsideTagBrackets(textBefore: string): boolean {
  const lastOpen = textBefore.lastIndexOf('[[')
  const lastClose = textBefore.lastIndexOf(']]')
  return lastOpen > lastClose
}

function handleInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (from !== to) return false
  if (text !== '"' && text !== "'") return false

  const textBefore = view.state.sliceDoc(0, from)
  if (isInsideTagBrackets(textBefore)) return false
  if (isInsideLiteralBody(view.state.doc.toString(), from)) return false

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
