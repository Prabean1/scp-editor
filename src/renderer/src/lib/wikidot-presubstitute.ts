// SCP-specific include/module calls (license box, image gallery blocks,
// classification bars, the Rate voting module) only resolve against the
// live wiki. Recognized ones are rewritten here into faked-but-*valid raw
// Wikidot markup* before the text reaches ftml, so ftml stays the single
// source of truth for how that markup actually renders — only the "fetch a
// shared template from the live wiki" step is faked. Anything unrecognized
// is left untouched: ftml already degrades unresolved [[include]]/[[module]]
// calls to visible, editable text on its own (confirmed in
// spike/render-test.mjs).

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
  return withIncludes.replace(MODULE_RATE_RE, fakeRateModule)
}
