import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

// Callback saves the image via IPC and returns the local:<id> marker to
// insert; see wikidot-presubstitute.ts for how that marker renders in the
// preview. Null means the file was rejected (unsupported format).
type DropImage = (file: File) => Promise<string | null>

function firstImageFile(files: File[]): File | null {
  return files.find((file) => file.type.startsWith('image/')) ?? null
}

export function imageDropAndPaste(onDropImage: DropImage): Extension {
  return EditorView.domEventHandlers({
    drop(event, view) {
      const file = firstImageFile(Array.from(event.dataTransfer?.files ?? []))
      if (!file) return false
      event.preventDefault()
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length
      onDropImage(file).then((marker) => {
        if (!marker) return
        view.dispatch({ changes: { from: pos, insert: marker } })
      })
      return true
    },
    paste(event, view) {
      const files = Array.from(event.clipboardData?.items ?? [])
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
      const file = firstImageFile(files)
      if (!file) return false
      event.preventDefault()
      const { from, to } = view.state.selection.main
      onDropImage(file).then((marker) => {
        if (!marker) return
        view.dispatch({
          changes: { from, to, insert: marker },
          selection: { anchor: from + marker.length }
        })
      })
      return true
    }
  })
}
