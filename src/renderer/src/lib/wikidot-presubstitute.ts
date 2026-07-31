import type { CachedInclude } from './include-cache'

const INCLUDE_RE = /\[\[include\s+((?:"[^"]*"|[\s\S])*?)\]\]/gi
const MODULE_RATE_RE = /\[\[module\s+rate\b[^\]]*\]\]/gi

interface ParsedInclude {
  path: string
  params: Record<string, string>
}

function parseIncludeInner(inner: string): ParsedInclude | null {
  // Params share a line with a leading pipe (|a=1 |b=2), so split on the
  // pipe lookahead too, not just newlines.
  const lines = inner
    .split(/\r?\n|(?=\|)/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const params: Record<string, string> = {}
  let path = ''
  for (const line of lines) {
    const paramMatch = line.match(/^\|?\s*([\w-]+)\s*=\s*(.*)$/)
    if (paramMatch) {
      params[paramMatch[1].toLowerCase()] = paramMatch[2].trim().replace(/^"(.*)"$/, '$1')
    } else if (!path) {
      path = line
    }
  }
  if (!path) return null
  return { path, params }
}

function fakeLicenseBox(): string {
  return [
    '[[div class="wd-fake-license-box"]]',
    'Unless otherwise stated, the content of this page is licensed under Creative Commons Attribution-ShareAlike 3.0 License.',
    '[[/div]]'
  ].join('\n')
}

// Map, not a plain object — |align=toString would otherwise resolve to
// Object.prototype.toString and leak into the generated [[div]] head.
const IMAGE_ALIGN_CLASS = new Map([
  ['left', 'wd-fake-image-left'],
  ['right', 'wd-fake-image-right'],
  ['center', 'wd-fake-image-center']
])

// Style value is rebuilt from these capture groups, not the raw input, so a
// stray quote or bracket can't escape into the [[div]] head.
const MEASUREMENT_RE = /^(\d+(?:\.\d+)?)(px|%|em|rem|ex|pt|cm|mm|in)?$/i

function imageWidthStyle(width: string | undefined): string {
  const match = width?.trim().match(MEASUREMENT_RE)
  if (!match) return ''
  return ` style="width: ${match[1]}${(match[2] ?? 'px').toLowerCase()};"`
}

function fakeImageBlock(params: Record<string, string>): string {
  const name = params.name ?? 'unknown'
  const alignClass =
    IMAGE_ALIGN_CLASS.get((params.align ?? '').toLowerCase()) ?? IMAGE_ALIGN_CLASS.get('right')
  const alt = params['alt-text'] ?? params.alt
  const parts = [
    `[[div class="wd-fake-image-block ${alignClass}"${imageWidthStyle(params.width)}]]`,
    `[[div class="wd-fake-image-placeholder"]]Image: ${name} — not resolved offline[[/div]]`
  ]
  if (alt) {
    parts.push(`[[div class="wd-fake-image-alt"]]alt: ${alt}[[/div]]`)
  }
  if (params.caption) {
    parts.push(`[[div class="wd-fake-image-caption"]]${params.caption}[[/div]]`)
  }
  parts.push('[[/div]]')
  return parts.join('\n')
}

function fakeClassifiedDecoration(): string {
  return [
    '[[div class="wd-fake-classified-bar"]]',
    '//classification decoration — not resolved offline//',
    '[[/div]]'
  ].join('\n')
}

function fakeAnomalyClassBar(): string {
  return [
    '[[div class="wd-fake-class-bar"]]',
    '//anomaly class bar — not resolved offline//',
    '[[/div]]'
  ].join('\n')
}

function fakeRateModule(): string {
  return [
    '[[div class="wd-fake-rating"]]',
    '[[span class="wd-fake-rate-btn"]]+[[/span]] [[span class="wd-fake-rate-score"]]0[[/span]] [[span class="wd-fake-rate-btn"]]−[[/span]]',
    '[[/div]]'
  ].join('\n')
}

const MEDIA_TYPES = new Set(['audio', 'video'])

function fakeHtml5Player(params: Record<string, string>): string {
  const kind = MEDIA_TYPES.has(params.type ?? '') ? params.type : 'media'
  const parts = ['[[div class="wd-fake-media"]]', `//${kind} player — not resolved offline//`]
  if (params.url) {
    parts.push(params.url)
  }
  parts.push('[[/div]]')
  return parts.join('\n')
}

// Rewritten to a resource:// URL for offline preview — ftml passes that scheme through untouched,
// served by the main process's protocol handler scoped to the image cache directory.
const LOCAL_IMAGE_RE = /\blocal:([a-f0-9]{16}\.(?:png|jpe?g|gif|webp))\b/g

export interface PresubstituteOptions {
  onlineFeatures?: boolean
  getCached?: (path: string) => CachedInclude | undefined
}

// Not a full cycle detector — a chain-membership check plus a depth cap, same
// "never throw, degrade visibly" philosophy ftml itself uses.
const MAX_INCLUDE_DEPTH = 10

function fakeUnresolvedInclude(path: string, reason: string): string {
  return [
    '[[div class="wd-fake-unresolved-include"]]',
    `//unresolved include: ${path} — ${reason}//`,
    '[[/div]]'
  ].join('\n')
}

// Wikidot's own {$param} / {$param|default} include-template syntax.
function substituteTemplateParams(source: string, params: Record<string, string>): string {
  return source.replace(
    /\{\$([\w-]+)(?:\|([^}]*))?\}/g,
    (_match, name: string, fallback: string | undefined) => {
      const value = params[name.toLowerCase()]
      return value !== undefined ? value : (fallback ?? '')
    }
  )
}

function substituteIncludes(
  source: string,
  options: PresubstituteOptions,
  chain: ReadonlySet<string>,
  depth: number
): string {
  return source.replace(INCLUDE_RE, (match, inner: string) => {
    const parsed = parseIncludeInner(inner)
    if (!parsed) return match
    const path = parsed.path.toLowerCase()

    if (options.onlineFeatures && options.getCached) {
      if (depth >= MAX_INCLUDE_DEPTH) {
        return fakeUnresolvedInclude(path, 'include depth limit reached')
      }
      if (chain.has(path)) return fakeUnresolvedInclude(path, 'circular include')

      const cached = options.getCached(path)
      if (cached?.status === 'resolved') {
        const substituted = substituteTemplateParams(cached.source, parsed.params)
        const nextChain = new Set(chain)
        nextChain.add(path)
        return substituteIncludes(substituted, options, nextChain, depth + 1)
      }
      if (cached?.status === 'error') return fakeUnresolvedInclude(path, cached.message)
      // Pending or not yet requested (the resolution loop hasn't caught up with
      // this edit yet) — fall through to the offline fakes below so the preview
      // still shows something reasonable while the fetch is in flight.
    }

    if (path.includes('license-box')) return fakeLicenseBox()
    if (path.includes('image-block')) return fakeImageBlock(parsed.params)
    if (path.includes('classified')) return fakeClassifiedDecoration()
    if (path.includes('class-bar') || path.includes('anomaly-class')) return fakeAnomalyClassBar()
    if (path.includes('html5player')) return fakeHtml5Player(parsed.params)
    if (options.onlineFeatures) return fakeUnresolvedInclude(path, 'resolving…')
    return match
  })
}

export function presubstitute(source: string, options: PresubstituteOptions = {}): string {
  const withIncludes = substituteIncludes(source, options, new Set(), 0)
  const withRateModule = withIncludes.replace(MODULE_RATE_RE, fakeRateModule)
  return withRateModule.replace(
    LOCAL_IMAGE_RE,
    (_match, id: string) => `resource://scp-images/${id}`
  )
}

// Local-only image markers render as broken syntax if copied to the real wiki.
export function findLocalImageIds(source: string): string[] {
  return Array.from(source.matchAll(LOCAL_IMAGE_RE), (match) => match[1])
}

function directIncludePaths(source: string): string[] {
  const paths: string[] = []
  for (const match of source.matchAll(INCLUDE_RE)) {
    const parsed = parseIncludeInner(match[1])
    if (parsed) paths.push(parsed.path.toLowerCase())
  }
  return paths
}

// Used by the online-features resolution loop to know which paths to fetch.
// Recurses into already-resolved includes' own source so nested includes get
// picked up in the same pass — a fetch that just landed shouldn't need a
// second full debounce cycle before its own includes start resolving.
export function collectIncludePaths(
  source: string,
  getCached: (path: string) => CachedInclude | undefined,
  seen: Set<string> = new Set(),
  depth = 0
): string[] {
  if (depth >= MAX_INCLUDE_DEPTH) return []
  const found = new Set<string>()
  for (const path of directIncludePaths(source)) {
    if (seen.has(path)) continue
    found.add(path)
    seen.add(path)
    const cached = getCached(path)
    if (cached?.status === 'resolved') {
      for (const nested of collectIncludePaths(cached.source, getCached, seen, depth + 1)) {
        found.add(nested)
      }
    }
  }
  return Array.from(found)
}
