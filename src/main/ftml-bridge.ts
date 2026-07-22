import { app } from 'electron'
import { join } from 'path'

// Runtime-computed path so bundlers don't try to statically resolve/rewrite
// this require() — the vendored ftml wasm pkg lives outside the app bundle.
function ftmlPkgDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'ftml-pkg')
    : join(__dirname, '../../resources/ftml-pkg')
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ftml = require(join(ftmlPkgDir(), 'ftml.js'))

export interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

export interface RenderResult {
  html: string
  errors: unknown[]
}

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

  // NOTE: ftml's wasm-bindgen classes are consumed (freed) when passed by
  // value into a function. .copy() is required to reuse an instance across
  // multiple calls (confirmed empirically in spike/render-test.mjs).
  const parseOutcome = ftml.parse(tokenization, info.copy(), settings.copy())
  const htmlOutput = ftml.render_html(parseOutcome.syntax_tree(), info, settings)

  return {
    html: htmlOutput.body(),
    errors: parseOutcome.errors()
  }
}

export function ftmlVersion(): string {
  return ftml.version()
}
