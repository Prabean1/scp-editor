import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import type { EditorStyle } from '../lib/theme'
import { wikidotAutoClose } from '../lib/wikidot-autoclose'
import { unclosedTagsLinter } from '../lib/unclosed-tags-linter'
import { smartQuotes as smartQuotesExtension } from '../lib/smart-quotes'
import { imageDropAndPaste } from '../lib/image-drop'

export interface EditorHandle {
  insertSyntax: (before: string, after?: string) => void
  prefixLines: (prefix: string) => void
}

interface EditorProps {
  value: string
  onChange: (value: string) => void
  editorStyle: EditorStyle
  autoClose: boolean
  lintUnclosedTags: boolean
  smartQuotes: boolean
  onDropImage: (file: File) => Promise<string | null>
}

// No Wikidot language mode: it conflicts with Markdown's own (`+` vs `#`
// headers, `//x//` vs `*x*` italics, etc.), so a wrong-but-plausible
// highlighter would be worse than none.
const fontTheme = EditorView.theme({
  '&': { fontSize: '13px', height: '100%' },
  '.cm-content': {
    fontFamily: "'SFMono-Regular', Consolas, monospace",
    lineHeight: '1.6'
  },
  '.cm-scroller': { overflow: 'auto' }
})

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, onChange, editorStyle, autoClose, lintUnclosedTags, smartQuotes, onDropImage },
  ref
) {
  const viewRef = useRef<EditorView | null>(null)

  useImperativeHandle(ref, () => ({
    insertSyntax(before: string, after = '') {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const selected = view.state.sliceDoc(from, to)
      const insertText = before + selected + after
      const cursor = from + before.length + selected.length
      view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: cursor }
      })
      view.focus()
    },
    prefixLines(prefix: string) {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const { doc } = view.state
      // A selection ending exactly at a line start doesn't include that line.
      const lastPos = to > from && to === doc.lineAt(to).from ? to - 1 : to
      const firstLine = doc.lineAt(from).number
      const lastLine = doc.lineAt(lastPos).number
      const marker = prefix.trimEnd()
      const changes: { from: number; insert: string }[] = []
      let firstLineShift = 0
      for (let n = firstLine; n <= lastLine; n++) {
        const line = doc.line(n)
        if (line.text.startsWith(marker)) continue
        changes.push({ from: line.from, insert: prefix })
        if (n === firstLine) firstLineShift = prefix.length
      }
      if (changes.length === 0) {
        view.focus()
        return
      }
      view.dispatch({
        changes,
        selection: {
          anchor: from + firstLineShift,
          head: to + prefix.length * changes.length
        }
      })
      view.focus()
    }
  }))

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={(view) => {
        viewRef.current = view
      }}
      theme={editorStyle === 'paper' ? 'light' : 'dark'}
      height="100%"
      extensions={[
        fontTheme,
        ...(autoClose ? [wikidotAutoClose()] : []),
        ...(lintUnclosedTags ? [unclosedTagsLinter()] : []),
        ...(smartQuotes ? [smartQuotesExtension()] : []),
        imageDropAndPaste(onDropImage)
      ]}
      basicSetup={{ foldGutter: false, closeBrackets: false }}
      style={{ height: '100%' }}
    />
  )
})

export default Editor
