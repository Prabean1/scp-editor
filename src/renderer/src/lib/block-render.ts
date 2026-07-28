const FOOTNOTE_OPEN_RE = /\[\[\s*footnote(\s|\])/i
const FOOTNOTE_OPEN_G_RE = /\[\[\s*footnote(\s|\])/gi
const FOOTNOTE_BLOCK_RE = /\[\[\s*footnoteblock\b/i

// Every raw block is rendered by ftml as its own standalone document, and ftml
// auto-appends a "Footnotes" list to any document that has footnotes and no
// explicit [[footnoteblock]] — so every footnote-containing block got its own
// list. Appending a hidden one here satisfies that check without rendering
// anything, leaving just the inline marker.
export function suppressBlockFootnoteList(raw: string): string {
  if (!FOOTNOTE_OPEN_RE.test(raw)) return raw
  if (FOOTNOTE_BLOCK_RE.test(raw)) return raw
  return raw + '\n[[footnoteblock hide="true"]]'
}

export function countFootnotes(raw: string): number {
  return raw.match(FOOTNOTE_OPEN_G_RE)?.length ?? 0
}

// ftml numbers footnotes within a single rendered document starting at 1, but each raw
// block is its own document — so a block's markers need shifting by however many
// footnotes precede it elsewhere in the doc to read as one continuous sequence.
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
