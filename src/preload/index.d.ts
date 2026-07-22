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

interface Article {
  filePath: string
  source: string
  pageInfo: PageInfoInput
}

interface Api {
  renderWikitext: (source: string, pageInfo?: PageInfoInput) => Promise<RenderResult>

  openFileDialog: () => Promise<Article | null>
  openFilePath: (filePath: string) => Promise<Article | null>
  saveFile: (filePath: string, source: string, pageInfo: PageInfoInput) => Promise<string>
  saveFileDialog: (
    source: string,
    pageInfo: PageInfoInput,
    suggestedName?: string
  ) => Promise<string | null>
  getRecentFiles: () => Promise<string[]>

  setDirty: (dirty: boolean) => void
  confirmDiscard: () => Promise<'save' | 'discard' | 'cancel'>
  reportSaveBeforeCloseResult: (ok: boolean) => void

  onMenuNew: (callback: () => void) => () => void
  onMenuOpen: (callback: () => void) => () => void
  onMenuSave: (callback: () => void) => () => void
  onMenuSaveAs: (callback: () => void) => () => void
  onMenuOpenPath: (callback: (filePath: string) => void) => () => void
  onSaveBeforeClose: (callback: () => void) => () => void
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
