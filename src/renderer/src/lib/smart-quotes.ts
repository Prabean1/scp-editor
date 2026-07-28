import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { isInsideLiteralBody, maskInlineEscapes } from './unclosed-tags'

// Wikidot uses literal straight " structurally (param="value") — curling it there would corrupt
// the tag; checks below look backward only, so they stay correct while a tag is still mid-type.

// ']' and '}' precede a fresh quote with no space, e.g. [[div]]"quoted" —
// that quote should open, not close.
const OPEN_PUNCT = new Set(['(', '[', '{', ']', '}'])

const CURLY: Record<string, { open: string; close: string }> = {
  '"': { open: '“', close: '”' },
  "'": { open: '‘', close: '’' }
}

// Net depth, not last-position comparison — a nested tag's ]] can sit after an outer tag's
// still-open [[, which last-occurrence comparison would misread as "outside brackets".
function isInsideTagBrackets(maskedTextBefore: string): boolean {
  let depth = 0
  const re = /\[\[|\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(maskedTextBefore))) {
    depth += m[0] === '[[' ? 1 : -1
  }
  return depth > 0
}

// @@...@@ escapes forbid newlines, so an odd count of "@@" tokens since line
// start means the cursor is inside a still-open escape.
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
