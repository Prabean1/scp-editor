import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

// Drag-and-drop and paste-from-clipboard both funnel through the same
// callback: it's responsible for saving the image (over IPC, to
// image-store.ts in the main process) and handing back the local:<id>
// marker text ready to insert — see wikidot-presubstitute.ts for how that
// marker gets resolved to something visible in the preview. Returns null if
// the file was rejected (e.g. an unsupported format).
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
