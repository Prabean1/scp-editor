interface StatusBarProps {
  errors: unknown[]
  filePath: string | null
  isDirty: boolean
}

export default function StatusBar({
  errors,
  filePath,
  isDirty
}: StatusBarProps): React.JSX.Element {
  const name = filePath ? filePath.replace(/^.*[/\\]/, '') : 'Untitled'
  return (
    <div className="status-bar">
      <span className="status-file">
        {isDirty ? '● ' : ''}
        {name}
        {isDirty ? ' — unsaved changes' : ''}
      </span>
      {' — '}
      {errors.length > 0 ? (
        <span className="status-errors">
          {errors.length} parse warning{errors.length === 1 ? '' : 's'}
        </span>
      ) : (
        <span>Rendered via ftml.</span>
      )}
      {' — '}
      SCP components not faked by the pre-substitution pass ([[include]]/[[module]] calls to the
      live wiki) render as visible, editable placeholder text.
    </div>
  )
}
