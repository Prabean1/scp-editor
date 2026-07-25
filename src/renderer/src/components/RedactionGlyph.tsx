// The icon IS the character it inserts, not a stand-in symbol. Its own file
// so toolbar-config.tsx (which also exports plain functions/types) stays a
// valid Fast Refresh boundary.
export default function RedactionGlyph({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <span style={{ fontSize: size, lineHeight: 1, fontFamily: 'monospace' }} aria-hidden="true">
      █
    </span>
  )
}
