// SCP-specific include/module calls (license box, image gallery, classification
// bars, the Rate module) only resolve against the live wiki. Recognized ones are
// rewritten into faked-but-valid raw Wikidot markup so ftml stays the source of
// truth for rendering — only the "fetch template" step is faked. Unrecognized
// calls are left untouched; ftml already degrades them to visible, editable
// text on its own.

const INCLUDE_RE = /\[\[include\s+([\s\S]*?)\]\]/gi
const MODULE_RATE_RE = /\[\[module\s+rate\b[^\]]*\]\]/gi

interface ParsedInclude {
  path: string
  params: Record<string, string>
}

function parseIncludeInner(inner: string): ParsedInclude | null {
  const lines = inner
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const params: Record<string, string> = {}
  let path = ''
  for (const line of lines) {
    const paramMatch = line.match(/^(\w+)=(.*)$/)
    if (paramMatch) {
      params[paramMatch[1]] = paramMatch[2]
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

function fakeImageBlock(params: Record<string, string>): string {
  const name = params.name ?? 'unknown'
  const caption = params.caption ?? ''
  const parts = [
    '[[div class="wd-fake-image-block"]]',
    `[[div class="wd-fake-image-placeholder"]]Image: ${name} — not resolved offline[[/div]]`
  ]
  if (caption) {
    parts.push(`[[div class="wd-fake-image-caption"]]${caption}[[/div]]`)
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

// Locally-dropped images are saved by image-store.ts as `[[image local:<id>]]`
// — never real Wikidot syntax, so clipboard-export.ts can warn before a paste
// to the live wiki. Here it's rewritten to a `resource://` URL for offline
// preview: ftml passes that scheme through untouched (ftml/src/url.rs's
// hardcoded allow-list), and the main process serves it via a protocol
// handler scoped to the image cache directory.
const LOCAL_IMAGE_RE = /\blocal:([a-f0-9]{16}\.(?:png|jpe?g|gif|webp))\b/g

export function presubstitute(source: string): string {
  const withIncludes = source.replace(INCLUDE_RE, (match, inner: string) => {
    const parsed = parseIncludeInner(inner)
    if (!parsed) return match
    const path = parsed.path.toLowerCase()
    if (path.includes('license-box')) return fakeLicenseBox()
    if (path.includes('image-block')) return fakeImageBlock(parsed.params)
    if (path.includes('classified')) return fakeClassifiedDecoration()
    if (path.includes('class-bar') || path.includes('anomaly-class')) return fakeAnomalyClassBar()
    return match
  })
  const withRateModule = withIncludes.replace(MODULE_RATE_RE, fakeRateModule)
  return withRateModule.replace(
    LOCAL_IMAGE_RE,
    (_match, id: string) => `resource://scp-images/${id}`
  )
}

// Used by the clipboard-export warning to catch local-only image markers
// before a copy to the real wiki, where they'd render as broken syntax.
export function findLocalImageIds(source: string): string[] {
  return Array.from(source.matchAll(LOCAL_IMAGE_RE), (match) => match[1])
}
