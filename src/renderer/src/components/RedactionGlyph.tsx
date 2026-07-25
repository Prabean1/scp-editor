export default function RedactionGlyph({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <span style={{ fontSize: size, lineHeight: 1, fontFamily: 'monospace' }} aria-hidden="true">
      █
    </span>
  )
}
