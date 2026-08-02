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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- ftml is untyped (require()'d wasm module)
function prepare(source: string, pageInfo: PageInfoInput) {
  const settings = ftml.WikitextSettings.from_mode('page', 'wikidot')
  const info = new ftml.PageInfo(pageInfo)
  const preprocessed = ftml.preprocess(source)
  const tokenization = ftml.tokenize(preprocessed)
  return { settings, info, tokenization }
}

export function renderWikitext(
  source: string,
  pageInfo: PageInfoInput = DEFAULT_PAGE_INFO
): RenderResult {
  const { settings, info, tokenization } = prepare(source, pageInfo)

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
  const { settings, info, tokenization } = prepare(source, pageInfo)
  const parseOutcome = ftml.parse(tokenization, info, settings)

  return {
    ast: parseOutcome.syntax_tree().data(),
    errors: parseOutcome.errors()
  }
}

// Skips ftml.preprocess() — it shifts character offsets (CRLF/tab/blank-line
// normalization), but block segmentation needs spans into the raw source.
export function tokenizeWikitext(source: string): { tokens: FtmlToken[] } {
  const tokenization = ftml.tokenize(source)
  return { tokens: tokenization.tokens() }
}
