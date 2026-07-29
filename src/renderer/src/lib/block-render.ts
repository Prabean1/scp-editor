const FOOTNOTE_OPEN_RE = /\[\[\s*footnote(\s|\])/i
const FOOTNOTE_OPEN_G_RE = /\[\[\s*footnote(\s|\])/gi
const FOOTNOTE_BLOCK_RE = /\[\[\s*footnoteblock\b/i

// ftml auto-appends a Footnotes list to any standalone document with footnotes
// and no explicit [[footnoteblock]]; a hidden one suppresses that per-block duplicate.
export function suppressBlockFootnoteList(raw: string): string {
  if (!FOOTNOTE_OPEN_RE.test(raw)) return raw
  if (FOOTNOTE_BLOCK_RE.test(raw)) return raw
  return raw + '\n[[footnoteblock hide="true"]]'
}

export function countFootnotes(raw: string): number {
  return raw.match(FOOTNOTE_OPEN_G_RE)?.length ?? 0
}

// Each raw block is numbered from 1 by ftml independently; shift by preceding
// blocks' footnote counts so markers read as one continuous sequence.
const FOOTNOTE_REF_RE =
  /aria-label="Footnote (\d+)\." data-id="\d+">\d+<\/wj-footnote-ref-marker><span class="wj-footnote-ref-tooltip" aria-hidden="true"><span class="wj-footnote-ref-tooltip-label">Footnote \d+\.<\/span>/g

export function renumberFootnotes(html: string, offset: number): string {
  if (offset === 0) return html
  return html.replace(FOOTNOTE_REF_RE, (_match, localNum: string) => {
    const n = offset + Number(localNum)
    return (
      `aria-label="Footnote ${n}." data-id="${n}">${n}</wj-footnote-ref-marker>` +
      `<span class="wj-footnote-ref-tooltip" aria-hidden="true">` +
      `<span class="wj-footnote-ref-tooltip-label">Footnote ${n}.</span>`
    )
  })
}
