import { useEffect, useLayoutEffect, useRef } from 'react'
import '../assets/preview.css'

interface PreviewPaneProps {
  html: string
}

// :scope keeps a tabview nested inside a tab from stealing the outer one's buttons.
const TAB_BUTTONS = ':scope > .wj-tabs-button-list > .wj-tabs-button'
const TAB_PANELS = ':scope > .wj-tabs-panel-list > .wj-tabs-panel'

function showTab(root: Element, index: number): void {
  root.querySelectorAll<HTMLElement>(TAB_BUTTONS).forEach((button, i) => {
    button.setAttribute('aria-selected', String(i === index))
    button.setAttribute('tabindex', i === index ? '0' : '-1')
  })
  root.querySelectorAll<HTMLElement>(TAB_PANELS).forEach((panel, i) => {
    panel.hidden = i !== index
  })
}

// ftml emits Wikidot's own tab/bottom-collapse markup, normally driven by Wikidot's own
// JavaScript — without this, only the first tab is reachable and "hide" does nothing.
export default function PreviewPane({ html }: PreviewPaneProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  // Tab ids are regenerated on every render, so the open tab is tracked by
  // position and reapplied once the new preview HTML is in place.
  const openTabsRef = useRef<number[]>([])
  // The innerHTML swap on re-render resets scrollTop to 0 before any effect
  // cleanup can read it, so the offset is tracked continuously instead.
  const scrollTopRef = useRef(0)

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const handleScroll = (): void => {
      scrollTopRef.current = scroller.scrollTop
    }
    scroller.addEventListener('scroll', handleScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const handleClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) return

      const bottom = event.target.closest('.wj-collapsible-button-bottom')
      if (bottom) {
        const details = bottom.closest('details')
        if (details) details.open = false
        return
      }

      const button = event.target.closest('.wj-tabs-button')
      const root = button?.closest('.wj-tabs')
      if (!button || !root) return
      const index = Array.from(root.querySelectorAll(TAB_BUTTONS)).indexOf(button)
      const rootIndex = Array.from(page.querySelectorAll('.wj-tabs')).indexOf(root)
      openTabsRef.current[rootIndex] = index
      showTab(root, index)
    }
    page.addEventListener('click', handleClick)
    return () => page.removeEventListener('click', handleClick)
  }, [])

  // Layout effect so the scroll restore lands before paint, matching how the
  // browser's own scrollTop reset (from the innerHTML swap) already happened
  // synchronously — a passive effect here would show one frame at the top.
  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page) return
    page.querySelectorAll('.wj-tabs').forEach((root, i) => {
      const count = root.querySelectorAll(TAB_BUTTONS).length
      const index = Math.min(openTabsRef.current[i] ?? 0, count - 1)
      if (index > 0) showTab(root, index)
    })
    const scroller = scrollRef.current
    if (scroller) scroller.scrollTop = scrollTopRef.current
  }, [html])

  return (
    <div className="preview-pane" ref={scrollRef}>
      <div className="scp-page-wrap" ref={pageRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
