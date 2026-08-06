import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash, randomBytes } from 'crypto'
import { writeFileAtomic } from './file-ops'
import { unescapeSource } from '../shared/wikidot-source'
import { canonicalizeIncludePath, splitCanonicalPath } from '../shared/include-path'
import { isOnlineFeaturesEnabled } from './online-features'
import type { IncludeResolution } from '../shared/types'

const FETCH_TIMEOUT_MS = 10_000

const PAGE_ID_RE = /WIKIREQUEST\.info\.pageId\s*=\s*(\d+)/

// Bump on any on-disk shape/unescaping change — a mismatch reads as a cache
// miss, so existing installs self-heal instead of keeping stale source.
const CACHE_VERSION = 2
type CachedResolution = IncludeResolution & { version: number }

// Wikidot's front end 503s Node's default fetch User-Agent — a browser-like
// one is required, confirmed against the live site.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function cacheRoot(): string {
  return join(app.getPath('userData'), 'include-cache')
}

function cachePathFor(path: string): string {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 16)
  return join(cacheRoot(), `${hash}.json`)
}

function urlFor(path: string): string {
  const { site, page } = splitCanonicalPath(path)
  return `https://${site}.wikidot.com/${page}`
}

async function fetchRawSource(path: string): Promise<string> {
  const pageUrl = urlFor(path)
  const pageRes = await fetch(pageUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (!pageRes.ok) throw new Error(`${pageUrl}: HTTP ${pageRes.status}`)
  const pageHtml = await pageRes.text()
  const pageIdMatch = PAGE_ID_RE.exec(pageHtml)
  if (!pageIdMatch) throw new Error(`${pageUrl}: could not find page ID`)

  const token = randomBytes(12).toString('hex')
  const body = new URLSearchParams({
    page_id: pageIdMatch[1],
    moduleName: 'viewsource/ViewSourceModule',
    wikidot_token7: token
  })
  const origin = new URL(pageUrl).origin
  const sourceRes = await fetch(`${origin}/ajax-module-connector.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `wikidot_token7=${token}`,
      'User-Agent': USER_AGENT
    },
    body: body.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (!sourceRes.ok) throw new Error(`${origin}: HTTP ${sourceRes.status}`)
  const json = (await sourceRes.json()) as { status: string; body?: string; message?: string }
  if (json.status !== 'ok' || typeof json.body !== 'string') {
    throw new Error(json.message ?? 'view-source module returned an error')
  }

  const sourceMatch = /<div class="page-source">([\s\S]*?)<\/div>/.exec(json.body)
  const escaped = sourceMatch ? sourceMatch[1] : json.body
  return unescapeSource(escaped).trim()
}

async function readCache(path: string): Promise<IncludeResolution | null> {
  try {
    const raw = await fs.readFile(cachePathFor(path), 'utf8')
    const cached = JSON.parse(raw) as CachedResolution
    if (cached.version !== CACHE_VERSION) return null
    return cached
  } catch {
    return null
  }
}

async function writeCache(path: string, resolution: IncludeResolution): Promise<void> {
  await fs.mkdir(cacheRoot(), { recursive: true })
  const cached: CachedResolution = { ...resolution, version: CACHE_VERSION }
  await writeFileAtomic(cachePathFor(path), JSON.stringify(cached, null, 2))
}

export async function resolveInclude(
  path: string,
  options: { forceRefresh?: boolean } = {}
): Promise<IncludeResolution> {
  // splitCanonicalPath's page group is `(.+)` — path, query, and fragment all
  // ride through into the fetch URL unless canonicalized first. Also collapses
  // case/site-prefix variants of the same include onto one cache entry, same
  // as the other two callers of canonicalizeIncludePath.
  const canonicalPath = canonicalizeIncludePath(path)
  if (canonicalPath === null) {
    return { status: 'error', message: 'invalid include path' }
  }

  if (!options.forceRefresh) {
    const cached = await readCache(canonicalPath)
    if (cached && cached.status === 'resolved') return cached
  }

  // Cache reads above are local disk, not network — only the fetch itself
  // needs the online-features consent gate.
  if (!isOnlineFeaturesEnabled()) {
    return { status: 'error', message: 'online features are disabled' }
  }

  let resolution: IncludeResolution
  try {
    const source = await fetchRawSource(canonicalPath)
    resolution = { status: 'resolved', source, fetchedAt: Date.now() }
  } catch (err) {
    resolution = { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }

  if (resolution.status === 'resolved') {
    await writeCache(canonicalPath, resolution)
  }
  return resolution
}
