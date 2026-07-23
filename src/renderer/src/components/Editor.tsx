import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import type { EditorStyle } from '../lib/theme'

export interface EditorHandle {
  insertSyntax: (before: string, after?: string) => void
}

interface EditorProps {
  value: string
  onChange: (value: string) => void
  editorStyle: EditorStyle
}

// No Wikidot language mode: it actively conflicts with Markdown's
// (`+` vs `#` headers, `//x//` vs `*x*` italics, etc.), so a
// wrong-but-plausible highlighter would be worse than none. Plain
// CodeMirror gets us the editor ergonomics (undo stack, line numbers)
// without misleading syntax colors.
const fontTheme = EditorView.theme({
  '&': { fontSize: '13px', height: '100%' },
  '.cm-content': {
    fontFamily: "'SFMono-Regular', Consolas, monospace",
    lineHeight: '1.6'
  },
  '.cm-scroller': { overflow: 'auto' }
})

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, onChange, editorStyle },
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
      extensions={[fontTheme]}
      basicSetup={{ foldGutter: false }}
      style={{ height: '100%' }}
    />
  )
})

export default Editor
