// The source viewer linkifies page references inside page-source with real
// <a> tags, not entities (confirmed live) — strip the wrapper, keep the link text.
const VIEWER_ANCHOR_RE = /<a\s[^>]*>([\s\S]*?)<\/a>/gi

// &amp; unescapes last — a source that legitimately contains "&lt;" (encoded
// as "&amp;lt;" by the viewer) would otherwise decode twice into "<".
export function unescapeSource(escaped: string): string {
  return escaped
    .replace(VIEWER_ANCHOR_RE, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}
