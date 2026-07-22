interface PageInfoInput {
  page: string
  category?: string | null
  site: string
  title: string
  alt_title?: string | null
  score: number
  tags: string[]
  language: string
}

interface RenderResult {
  html: string
  errors: unknown[]
}

interface Api {
  renderWikitext: (source: string, pageInfo?: PageInfoInput) => Promise<RenderResult>
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
