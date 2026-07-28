const FOOTNOTE_OPEN_RE = /\[\[\s*footnote(\s|\])/i
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
