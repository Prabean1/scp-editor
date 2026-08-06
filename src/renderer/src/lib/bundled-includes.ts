// The ./bundled/*.txt sources are vendored from the live wiki by an untracked
// local script — regenerate them through it rather than hand-editing.

import { canonicalizeIncludePath } from '../../../shared/include-path'
import licenseBox from './bundled/component-license-box.txt?raw'
import licenseBoxEnd from './bundled/component-license-box-end.txt?raw'
import licenseBoxBackend from './bundled/component-license-box-backend.txt?raw'
import anomalyClassBarSource from './bundled/component-anomaly-class-bar-source.txt?raw'
import imageBlock from './bundled/component-image-block.txt?raw'
import imageBlockBase from './bundled/component-image-block-base.txt?raw'
import preview from './bundled/component-preview.txt?raw'
import betterfootnotes from './bundled/component-betterfootnotes.txt?raw'
import acsAnimation from './bundled/component-acs-animation.txt?raw'
import themeBasalt from './bundled/theme-basalt.txt?raw'

export interface BundledInclude {
  path: string
  source: string
}

export interface BundledIncludeMeta {
  path: string
  title: string
  author: string | null
  sourceUrl: string
}

// Zero-network copies of the components almost every article includes.
// wikidot-presubstitute.ts consults these between live cache and fallback.
const BUNDLED_INCLUDES = new Map<string, string>([
  ["component:license-box", licenseBox],
  ["component:license-box-end", licenseBoxEnd],
  ["component:license-box-backend", licenseBoxBackend],
  ["component:anomaly-class-bar-source", anomalyClassBarSource],
  ["component:image-block", imageBlock],
  ["component:image-block-base", imageBlockBase],
  ["component:preview", preview],
  ["component:betterfootnotes", betterfootnotes],
  ["component:acs-animation", acsAnimation],
  ["theme:basalt", themeBasalt]
])

// Vendored content is CC BY-SA 3.0, separate from this project's own AGPL —
// these entries are the attribution record for the eventual NOTICE.md.
export const BUNDLED_INCLUDE_META: BundledIncludeMeta[] = [
  { path: "component:license-box", title: "License Box", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:license-box" },
  { path: "component:license-box-end", title: "License Box End", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:license-box-end" },
  { path: "component:license-box-backend", title: "License Box (backend)", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:license-box-backend" },
  { path: "component:anomaly-class-bar-source", title: "Anomaly Classification Bar for ACS", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:anomaly-class-bar-source" },
  { path: "component:image-block", title: "Standard Image Block", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:image-block" },
  { path: "component:image-block-base", title: "Standard Image Block (backend)", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:image-block-base" },
  { path: "component:preview", title: "Page Preview Component", author: null, sourceUrl: "https://scp-wiki.wikidot.com/component:preview" },
  { path: "component:betterfootnotes", title: "BetterFootnotes", author: "EstrellaYoshte", sourceUrl: "https://scp-wiki.wikidot.com/component:betterfootnotes" },
  { path: "component:acs-animation", title: "ACS Animation", author: "EstrellaYoshte", sourceUrl: "https://scp-wiki.wikidot.com/component:acs-animation" },
  { path: "theme:basalt", title: "Basalt Theme", author: "Liryn, Placeholder McD", sourceUrl: "https://scp-wiki.wikidot.com/theme:basalt" }
]

// Bundled content is scp-wiki-only — a canonical scp-wiki path never carries
// a ":site:" prefix (include-path.ts), so one starting with ":" isn't it.
export function getBundledInclude(path: string): BundledInclude | undefined {
  const canonical = canonicalizeIncludePath(path)
  if (!canonical || canonical.startsWith(':')) return undefined
  const source = BUNDLED_INCLUDES.get(canonical)
  return source === undefined ? undefined : { path: canonical, source }
}
