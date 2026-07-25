import { useEffect, useMemo, useRef, useState } from 'react'
import { findLocalImageIds } from '../lib/wikidot-presubstitute'
import type { AutosaveIntervalSeconds } from '../lib/theme'

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

export type ImageOwner = { kind: 'file'; filePath: string } | { kind: 'draft'; draftId: string }

interface Article {
  filePath: string
  source: string
  pageInfo: PageInfoInput
}

export interface DocumentHandle {
  source: string
  pageInfo: PageInfoInput
  filePath: string | null
  isDirty: boolean
  imageOwner: ImageOwner
  setSource: (next: string) => void
  setPageInfo: (next: PageInfoInput) => void
  new: () => Promise<void>
  open: () => Promise<void>
  openPath: (path: string) => Promise<void>
  save: () => Promise<boolean>
  saveAs: () => Promise<boolean>
  export: () => Promise<void>
  restoreSnapshot: (record: { source: string; pageInfo: PageInfoInput }) => void
}

const STARTER = `[[module Rate]]

[[include :scp-wiki:component:image-block
name=scp-xxxx-1.jpg
width="200px"
caption="Caption goes here."]]

**Item #:** SCP-XXXX

**Object Class:** Euclid

**Special Containment Procedures:** Write your containment procedures
here. This is a **placeholder** — the no-AI-content rule for this
project means you write every word of the actual article yourself.

**Description:** This paragraph is example body text so you can see
how a normal paragraph renders. //Italics//, **bold**, __underline__,
and --strikethrough-- all work.

[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]
Addendum content goes here. Collapsibles are common for
interview logs and incident reports.
[[/collapsible]]

||~ Column A||~ Column B||
||Row 1||Data||
||Row 2||Data||

[[include :scp-wiki:component:license-box]]
`

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

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000

export function useDocument(autosaveInterval: AutosaveIntervalSeconds): DocumentHandle {
  const [source, setSource] = useState(STARTER)
  const [pageInfo, setPageInfo] = useState<PageInfoInput>(DEFAULT_PAGE_INFO)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<{
    source: string
    pageInfo: PageInfoInput
  } | null>({ source: STARTER, pageInfo: DEFAULT_PAGE_INFO })
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID())

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false
    return (
      source !== savedSnapshot.source ||
      JSON.stringify(pageInfo) !== JSON.stringify(savedSnapshot.pageInfo)
    )
  }, [source, pageInfo, savedSnapshot])

  // IPC callbacks subscribed once at mount would otherwise close over stale
  // state; this ref keeps them reading current values. draftId rides along
  // too so imageOwner below can read it during render without tripping the
  // no-refs-in-render lint rule.
  const stateRef = useRef({ source, pageInfo, filePath, isDirty, draftId })
  useEffect(() => {
    stateRef.current = { source, pageInfo, filePath, isDirty, draftId }
  })

  useEffect(() => {
    window.api.setDirty(isDirty)
  }, [isDirty])

  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current
      if (!current.isDirty) return
      window.api.autosaveWrite({
        draftId: current.draftId,
        filePath: current.filePath,
        source: current.source,
        pageInfo: current.pageInfo
      })
    }, autosaveInterval * 1000)
    return () => clearInterval(timer)
  }, [autosaveInterval])

  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current
      if (!current.isDirty || !current.filePath) return
      window.api.snapshotWrite({
        filePath: current.filePath,
        source: current.source,
        pageInfo: current.pageInfo,
        trigger: 'timer'
      })
    }, SNAPSHOT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  function clearAutosaveForCurrent(): void {
    const { filePath: currentPath, draftId: currentDraftId } = stateRef.current
    window.api.autosaveClear({ draftId: currentDraftId, filePath: currentPath })
  }

  function applyArticle(article: Article): void {
    setSource(article.source)
    setPageInfo(article.pageInfo)
    setFilePath(article.filePath)
    setSavedSnapshot({ source: article.source, pageInfo: article.pageInfo })
  }

  async function applyArticleWithRecoveryCheck(article: Article): Promise<void> {
    const record = await window.api.autosaveCheckFile(article.filePath)
    if (!record) {
      applyArticle(article)
      return
    }
    const name = article.filePath.replace(/^.*[/\\]/, '')
    const choice = await window.api.autosaveConfirmRecovery(name, record)
    if (choice === 'recover') {
      setSource(record.source)
      setPageInfo(record.pageInfo)
      setFilePath(article.filePath)
      // Baseline is the on-disk article, not the recovered content — the
      // recovered text is unsaved work, so the doc must read as dirty.
      setSavedSnapshot({ source: article.source, pageInfo: article.pageInfo })
    } else {
      window.api.autosaveClear({ draftId: stateRef.current.draftId, filePath: article.filePath })
      applyArticle(article)
    }
  }

  async function performSaveAs(): Promise<boolean> {
    const { source: currentSource, pageInfo: currentPageInfo } = stateRef.current
    const newPath = await window.api.saveFileDialog(
      currentSource,
      currentPageInfo,
      currentPageInfo.page
    )
    if (!newPath) return false
    clearAutosaveForCurrent()
    await window.api.imageAdoptDraft(stateRef.current.draftId, newPath)
    setFilePath(newPath)
    setSavedSnapshot({ source: currentSource, pageInfo: currentPageInfo })
    window.api.snapshotWrite({
      filePath: newPath,
      source: currentSource,
      pageInfo: currentPageInfo,
      trigger: 'save'
    })
    return true
  }

  async function performSave(): Promise<boolean> {
    const {
      source: currentSource,
      pageInfo: currentPageInfo,
      filePath: currentPath
    } = stateRef.current
    if (currentPath) {
      await window.api.saveFile(currentPath, currentSource, currentPageInfo)
      clearAutosaveForCurrent()
      setSavedSnapshot({ source: currentSource, pageInfo: currentPageInfo })
      window.api.snapshotWrite({
        filePath: currentPath,
        source: currentSource,
        pageInfo: currentPageInfo,
        trigger: 'save'
      })
      return true
    }
    return performSaveAs()
  }

  async function guardDirty(): Promise<boolean> {
    if (!stateRef.current.isDirty) return true
    const choice = await window.api.confirmDiscard()
    if (choice === 'cancel') return false
    if (choice === 'save') return performSave()
    clearAutosaveForCurrent()
    return true
  }

  async function handleNew(): Promise<void> {
    if (!(await guardDirty())) return
    setDraftId(crypto.randomUUID())
    setSource(STARTER)
    setPageInfo(DEFAULT_PAGE_INFO)
    setFilePath(null)
    setSavedSnapshot({ source: STARTER, pageInfo: DEFAULT_PAGE_INFO })
  }

  async function handleOpen(): Promise<void> {
    if (!(await guardDirty())) return
    const article = await window.api.openFileDialog()
    if (article) await applyArticleWithRecoveryCheck(article)
  }

  async function handleOpenPath(path: string): Promise<void> {
    if (!(await guardDirty())) return
    const article = await window.api.openFilePath(path)
    if (article) await applyArticleWithRecoveryCheck(article)
  }

  async function handleExport(): Promise<void> {
    const { source: currentSource } = stateRef.current
    const localIds = findLocalImageIds(currentSource)
    if (localIds.length > 0) {
      const names = await window.api.imageResolveNames(localIds)
      const choice = await window.api.exportConfirmLocalImages(Object.values(names))
      if (choice !== 'copy') return
    }
    await window.api.clipboardWriteText(currentSource.replace(/\r\n/g, '\n'))
  }

  useEffect(() => {
    const unsubs = [
      window.api.onMenuNew(() => {
        handleNew()
      }),
      window.api.onMenuOpen(() => {
        handleOpen()
      }),
      window.api.onMenuSave(() => {
        performSave()
      }),
      window.api.onMenuSaveAs(() => {
        performSaveAs()
      }),
      window.api.onMenuOpenPath((path) => {
        handleOpenPath(path)
      }),
      window.api.onSaveBeforeClose(async () => {
        const ok = await performSave()
        window.api.reportSaveBeforeCloseResult(ok)
      })
    ]
    return () => unsubs.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api.autosaveListOrphans().then(async (orphans) => {
      if (cancelled || orphans.length === 0) return
      const [newest] = orphans
      const choice = await window.api.autosaveConfirmRecovery('an unsaved draft', newest.record)
      if (cancelled) return
      if (choice === 'recover') {
        setDraftId(newest.draftId)
        setSource(newest.record.source)
        setPageInfo(newest.record.pageInfo)
        setFilePath(null)
        setSavedSnapshot({ source: STARTER, pageInfo: DEFAULT_PAGE_INFO })
      } else {
        window.api.autosaveClear({ draftId: newest.draftId, filePath: null })
        window.api.imageClearDraft(newest.draftId)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Images whose article no longer exists at its saved path (renamed, moved,
  // deleted outside the app) — mirrors the orphan-autosave flow above, but
  // per missing article, and never deletes without asking.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const orphans = await window.api.imageListOrphans()
      for (const orphan of orphans) {
        if (cancelled) return
        const choice = await window.api.imageConfirmCleanup(orphan.filePath, orphan.entries.length)
        if (cancelled) return
        if (choice === 'delete') await window.api.imageDeleteOrphan(orphan.filePath)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function restoreSnapshot(record: { source: string; pageInfo: PageInfoInput }): void {
    setSource(record.source)
    setPageInfo(record.pageInfo)
  }

  const imageOwner: ImageOwner = filePath ? { kind: 'file', filePath } : { kind: 'draft', draftId }

  return {
    source,
    pageInfo,
    filePath,
    isDirty,
    imageOwner,
    setSource,
    setPageInfo,
    new: handleNew,
    open: handleOpen,
    openPath: handleOpenPath,
    save: performSave,
    saveAs: performSaveAs,
    export: handleExport,
    restoreSnapshot
  }
}
