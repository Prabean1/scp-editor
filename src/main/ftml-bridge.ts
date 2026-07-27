import { app } from 'electron'
import { join } from 'path'
import type { FtmlToken, PageInfoInput, RenderResult } from '../shared/types'

export type { FtmlToken, PageInfoInput, RenderResult }

// Computed at runtime so bundlers don't statically resolve/rewrite this
// require() — the vendored ftml wasm pkg lives outside the app bundle.
function ftmlPkgDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'ftml-pkg')
    : join(__dirname, '../../resources/ftml-pkg')
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ftml = require(join(ftmlPkgDir(), 'ftml.js'))

const DEFAULT_PAGE_INFO: PageInfoInput = {
  page: 'untitled',
  category: null,
  site: 'scp-wiki',
  title: 'Untitled',
  alt_title: null,
  score: 0,
  tags: [],
  language: 'en'
}

export function renderWikitext(
  source: string,
  pageInfo: PageInfoInput = DEFAULT_PAGE_INFO
): RenderResult {
  const settings = ftml.WikitextSettings.from_mode('page', 'wikidot')
  const info = new ftml.PageInfo(pageInfo)
  const preprocessed = ftml.preprocess(source)
  const tokenization = ftml.tokenize(preprocessed)

  // wasm-bindgen classes are consumed (freed) when passed by value — .copy()
  // avoids "Attempt to use a moved value" on the render_html call below.
  const parseOutcome = ftml.parse(tokenization, info.copy(), settings.copy())
  const htmlOutput = ftml.render_html(parseOutcome.syntax_tree(), info, settings)

  return {
    html: htmlOutput.body(),
    errors: parseOutcome.errors()
  }
}

export function parseWikitext(
  source: string,
  pageInfo: PageInfoInput = DEFAULT_PAGE_INFO
): { ast: unknown; errors: unknown[] } {
  const settings = ftml.WikitextSettings.from_mode('page', 'wikidot')
  const info = new ftml.PageInfo(pageInfo)
  const preprocessed = ftml.preprocess(source)
  const tokenization = ftml.tokenize(preprocessed)

  const parseOutcome = ftml.parse(tokenization, info, settings)

  return {
    ast: parseOutcome.syntax_tree().data(),
    errors: parseOutcome.errors()
  }
}

// Deliberately skips ftml.preprocess() — it normalizes CRLF, expands tabs,
// strips leading/trailing blank lines, and collapses 3+ newlines to 2, all
// of which shift offsets. Block segmentation needs spans that index
// directly into the user's raw source, not the normalized text ftml itself
// renders from.
export function tokenizeWikitext(source: string): { tokens: FtmlToken[] } {
  const tokenization = ftml.tokenize(source)
  return { tokens: tokenization.tokens() }
}

export function ftmlVersion(): string {
  return ftml.version()
}
