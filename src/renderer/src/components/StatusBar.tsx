interface StatusBarProps {
  errors: unknown[]
}

export default function StatusBar({ errors }: StatusBarProps): React.JSX.Element {
  return (
    <div className="status-bar">
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
