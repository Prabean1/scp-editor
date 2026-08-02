const SITE_PATH_RE = /^:([a-z0-9-]+):(.+)$/i
const DEFAULT_SITE = 'scp-wiki'

// ponytail: rejects `.` and `/` — no observed SCP page path uses either;
// widen if a real path ever needs them.
const PAGE_PATH_RE = /^[a-z0-9][a-z0-9:_-]*$/i

// Canonical cache/bundle-lookup key — bare for the default site (":scp-wiki:x"
// == "x"), ":site:page" otherwise, null for non-path input (viewer HTML, @@-text).
export function canonicalizeIncludePath(raw: string): string | null {
  const siteMatch = SITE_PATH_RE.exec(raw)
  const site = siteMatch ? siteMatch[1].toLowerCase() : null
  const page = siteMatch ? siteMatch[2] : raw
  if (!PAGE_PATH_RE.test(page)) return null
  return site && site !== DEFAULT_SITE ? `:${site}:${page.toLowerCase()}` : page.toLowerCase()
}

// Splits an already-canonical path back into its site and bare page, for
// building the fetch URL — the one other place that needs the site prefix.
export function splitCanonicalPath(canonical: string): { site: string; page: string } {
  const match = SITE_PATH_RE.exec(canonical)
  return match ? { site: match[1], page: match[2] } : { site: DEFAULT_SITE, page: canonical }
}
