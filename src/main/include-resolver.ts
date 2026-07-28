import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash, randomBytes } from 'crypto'
import { writeFileAtomic } from './file-ops'
import type { IncludeResolution } from '../shared/types'

const DEFAULT_SITE = 'scp-wiki'
const SITE_PATH_RE = /^:([a-z0-9-]+):(.+)$/i
const PAGE_ID_RE = /WIKIREQUEST\.info\.pageId\s*=\s*(\d+)/

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
  const match = SITE_PATH_RE.exec(path)
  const site = match ? match[1] : DEFAULT_SITE
  const page = match ? match[2] : path
  return `https://${site}.wikidot.com/${page}`
}

// Wikidot's source viewer HTML-escapes the raw wikitext for display.
function unescapeSource(escaped: string): string {
  return escaped
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function fetchRawSource(path: string): Promise<string> {
  const pageUrl = urlFor(path)
  const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT } })
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
    body: body.toString()
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
    return JSON.parse(raw) as IncludeResolution
  } catch {
    return null
  }
}

async function writeCache(path: string, resolution: IncludeResolution): Promise<void> {
  await fs.mkdir(cacheRoot(), { recursive: true })
  await writeFileAtomic(cachePathFor(path), JSON.stringify(resolution, null, 2))
}

export async function resolveInclude(
  path: string,
  options: { forceRefresh?: boolean } = {}
): Promise<IncludeResolution> {
  if (!options.forceRefresh) {
    const cached = await readCache(path)
    if (cached && cached.status === 'resolved') return cached
  }

  let resolution: IncludeResolution
  try {
    const source = await fetchRawSource(path)
    resolution = { status: 'resolved', source, fetchedAt: Date.now() }
  } catch (err) {
    resolution = { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }

  if (resolution.status === 'resolved') {
    await writeCache(path, resolution)
  }
  return resolution
}
