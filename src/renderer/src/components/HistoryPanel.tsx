import { useEffect, useState } from 'react'
import { diffLines } from 'diff'

interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

type SnapshotTrigger = 'save' | 'timer'

interface SnapshotRecord {
  filePath: string
  source: string
  pageInfo: PageInfoInput
  savedAt: number
  trigger: SnapshotTrigger
}

interface SnapshotMeta {
  id: string
  savedAt: number
  trigger: SnapshotTrigger
}

interface HistoryPanelProps {
  filePath: string
  source: string
  onRestore: (record: SnapshotRecord) => void
  onClose: () => void
}

export default function HistoryPanel({
  filePath,
  source,
  onRestore,
  onClose
}: HistoryPanelProps): React.JSX.Element {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [selected, setSelected] = useState<SnapshotRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.snapshotList(filePath).then((metas) => {
      if (!cancelled) setSnapshots(metas)
    })
    return () => {
      cancelled = true
    }
  }, [filePath])

  const selectSnapshot = (id: string): void => {
    window.api.snapshotRead(filePath, id).then((record) => {
      if (record) setSelected(record)
    })
  }

  const diffParts = selected ? diffLines(selected.source, source) : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Version History</h2>
        <div className="history-body">
          <ul className="history-list">
            {snapshots.length === 0 && <li className="history-empty">No snapshots yet.</li>}
            {snapshots.map((meta) => (
              <li key={meta.id}>
                <button
                  className={`history-entry ${selected?.savedAt === meta.savedAt ? 'active' : ''}`}
                  onClick={() => selectSnapshot(meta.id)}
                >
                  <span className={`history-badge history-badge-${meta.trigger}`}>
                    {meta.trigger === 'save' ? 'Saved' : 'Auto'}
                  </span>
                  <span className="history-time">{new Date(meta.savedAt).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="history-diff">
            {!selected && <p className="history-diff-placeholder">Select a version to compare.</p>}
            {selected &&
              diffParts.map((part, i) => (
                <pre
                  key={i}
                  className={part.added ? 'diff-add' : part.removed ? 'diff-del' : 'diff-context'}
                >
                  {part.value}
                </pre>
              ))}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button disabled={!selected} onClick={() => selected && onRestore(selected)}>
            Restore this version
          </button>
        </div>
      </div>
    </div>
  )
}
