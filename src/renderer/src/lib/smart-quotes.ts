import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { isInsideLiteralBody } from './unclosed-tags'

// Wikidot uses literal straight " structurally, not just in prose —
// [[include ... param="value"]], [[span style="color:red"]], etc. — so
// curling it there would silently corrupt the tag. Both suppression checks
// below only look backward from the cursor (never past it), which is what
// makes them correct while a tag or [[code]] block is still being typed,
// not just once it's complete. See
// .scratch/tier-2-history-and-editor-safety/smart-quotes.md and
// spike/prototype-smart-quotes/ for the reasoning and sample validation.

// ']' and '}' are included because a Wikidot tag's closing ']]' (or a '}')
// commonly precedes a fresh quote with no space, e.g. [[div]]"quoted" —
// that quote is opening, not closing.
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
