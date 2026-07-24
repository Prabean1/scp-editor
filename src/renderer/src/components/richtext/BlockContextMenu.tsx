// Minimal positioned popup for the right-click "Raw Text" escape hatch on a
// rich (heading/paragraph) block. No existing context-menu component in the
// codebase to match — this is intentionally tiny (one menu item today)
// rather than a general-purpose menu system nothing else needs yet.
import { useEffect, useRef } from 'react'

export interface BlockContextMenuItem {
  label: string
  onSelect: () => void
}

interface BlockContextMenuProps {
  x: number
  y: number
  items: BlockContextMenuItem[]
  onClose: () => void
}

export default function BlockContextMenu({
  x,
  y,
  items,
  onClose
}: BlockContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(e: PointerEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div ref={ref} className="richtext-context-menu" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="richtext-context-menu-item"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
