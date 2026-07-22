import { useState } from 'react'

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

interface PageInfoModalProps {
  pageInfo: PageInfoInput
  onSave: (pageInfo: PageInfoInput) => void
  onCancel: () => void
}

export default function PageInfoModal({
  pageInfo,
  onSave,
  onCancel
}: PageInfoModalProps): React.JSX.Element {
  const [draft, setDraft] = useState(pageInfo)
  const [tagsText, setTagsText] = useState(pageInfo.tags.join(', '))

  const handleSave = (): void => {
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSave({ ...draft, tags })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Page Info</h2>
        <label>
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Page Slug
          <input
            type="text"
            value={draft.page}
            onChange={(e) => setDraft({ ...draft, page: e.target.value })}
          />
        </label>
        <label>
          Alt Title
          <input
            type="text"
            value={draft.alt_title ?? ''}
            onChange={(e) => setDraft({ ...draft, alt_title: e.target.value || null })}
          />
        </label>
        <label>
          Category
          <input
            type="text"
            value={draft.category ?? ''}
            onChange={(e) => setDraft({ ...draft, category: e.target.value || null })}
          />
        </label>
        <label>
          Tags (comma-separated)
          <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </label>
        <label>
          Language
          <input
            type="text"
            value={draft.language}
            onChange={(e) => setDraft({ ...draft, language: e.target.value })}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
