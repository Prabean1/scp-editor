import { EditorView, keymap } from '@codemirror/view'
import { EditorSelection, Prec, type Extension } from '@codemirror/state'

// Trigger char -> its mirror/closer. '[' is opener-only (its closer is ']',
// which isn't itself an opener), everything else mirrors to itself.
const MIRROR: Record<string, string> = {
  '[': ']',
  '*': '*',
  '/': '/',
  '_': '_',
  '-': '-',
  '#': '#'
}

const CLOSER_CHARS = new Set(Object.values(MIRROR))

// Wikidot uses bare doubled '##'/'--' at line-start for nested list markers
// and rules, so pairing there would misfire on legitimate syntax.
const LINE_START_GUARDED = new Set(['-', '#'])

function isWhitespaceOnly(s: string): boolean {
  return /^\s*$/.test(s)
}

function handleInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (text.length !== 1) return false
  const { doc } = view.state

  if (from < to) {
    const mirror = MIRROR[text]
    if (!mirror) return false
    view.dispatch({
      changes: [
        { from, insert: text },
        { from: to, insert: mirror }
      ],
      selection: EditorSelection.range(from + 1, to + 1)
    })
    return true
  }

  if (CLOSER_CHARS.has(text) && doc.sliceString(from, from + 1) === text) {
    view.dispatch({ selection: EditorSelection.cursor(from + 1) })
    return true
  }

  const mirror = MIRROR[text]
  if (mirror && from > 0 && doc.sliceString(from - 1, from) === text) {
    if (LINE_START_GUARDED.has(text)) {
      const line = doc.lineAt(from - 1)
      if (isWhitespaceOnly(line.text.slice(0, from - 1 - line.from))) return false
    }
    view.dispatch({
      changes: { from, insert: text + mirror + mirror },
      selection: EditorSelection.cursor(from + 1)
    })
    return true
  }

  return false
}

function backspaceCollapsePair(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from !== to || from < 2 || from + 2 > view.state.doc.length) return false

  const before = view.state.sliceDoc(from - 2, from)
  if (before[0] !== before[1]) return false
  const mirror = MIRROR[before[0]]
  if (!mirror || view.state.sliceDoc(from, from + 2) !== mirror + mirror) return false

  view.dispatch({
    changes: { from: from - 2, to: from + 2, insert: '' },
    selection: EditorSelection.cursor(from - 2)
  })
  return true
}

export function wikidotAutoClose(): Extension {
  return [
    Prec.high(EditorView.inputHandler.of(handleInput)),
    Prec.high(keymap.of([{ key: 'Backspace', run: backspaceCollapsePair }]))
  ]
}
