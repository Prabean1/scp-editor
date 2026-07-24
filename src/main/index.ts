import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { renderWikitext, parseWikitext, type PageInfoInput } from './ftml-bridge'
import { readArticle, writeArticle, showOpenDialog, showSaveDialog } from './file-ops'
import { getRecentFiles, addRecentFile, removeRecentFile } from './recent-files'
import { buildMenu } from './menu'
import {
  writeAutosave,
  clearAutosave,
  checkFileAutosave,
  listOrphanAutosaves,
  type AutosaveInput,
  type AutosaveRecord
} from './autosave'
import { writeSnapshot, listSnapshots, readSnapshot, type SnapshotInput } from './snapshots'

let mainWindow: BrowserWindow | null = null
let isDirty = false

function findWikidotArg(argv: string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().endsWith('.wikidot')) ?? null
}

function openPathInRenderer(filePath: string): void {
  mainWindow?.webContents.send('menu:open-path', filePath)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isDirty || !mainWindow) return
    event.preventDefault()
    const win = mainWindow
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: 'You have unsaved changes. Save before closing?'
    })
    if (choice === 1) {
      isDirty = false
      win.destroy()
    } else if (choice === 0) {
      win.webContents.send('app:save-before-close')
      ipcMain.once('app:save-before-close-result', (_event, ok: boolean) => {
        if (ok) {
          isDirty = false
          win.destroy()
        }
      })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    const argvPath = findWikidotArg(process.argv)
    if (argvPath) openPathInRenderer(argvPath)
  })

  buildMenu(mainWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    const argvPath = findWikidotArg(argv)
    if (argvPath) openPathInRenderer(argvPath)
  })

  // macOS: launched or re-activated via a file in Finder/Dock.
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (mainWindow) {
      openPathInRenderer(filePath)
    } else {
      app.whenReady().then(() => openPathInRenderer(filePath))
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.scp-doc-editor.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.handle('ftml:render', (_event, source: string, pageInfo?: PageInfoInput) => {
      return renderWikitext(source, pageInfo)
    })

    ipcMain.handle('ftml:parse', (_event, source: string, pageInfo?: PageInfoInput) => {
      return parseWikitext(source, pageInfo)
    })

    ipcMain.handle('file:open-dialog', async () => {
      if (!mainWindow) return null
      const filePath = await showOpenDialog(mainWindow)
      if (!filePath) return null
      const article = await readArticle(filePath)
      addRecentFile(filePath)
      buildMenu(mainWindow)
      return article
    })

    ipcMain.handle('file:open-path', async (_event, filePath: string) => {
      try {
        const article = await readArticle(filePath)
        addRecentFile(filePath)
        if (mainWindow) buildMenu(mainWindow)
        return article
      } catch {
        removeRecentFile(filePath)
        if (mainWindow) buildMenu(mainWindow)
        return null
      }
    })

    ipcMain.handle(
      'file:save',
      async (_event, filePath: string, source: string, pageInfo: PageInfoInput) => {
        await writeArticle(filePath, source, pageInfo)
        addRecentFile(filePath)
        if (mainWindow) buildMenu(mainWindow)
        return filePath
      }
    )

    ipcMain.handle(
      'file:save-dialog',
      async (_event, source: string, pageInfo: PageInfoInput, suggestedName?: string) => {
        if (!mainWindow) return null
        const defaultPath = suggestedName ? `${suggestedName}.wikidot` : undefined
        const filePath = await showSaveDialog(mainWindow, defaultPath)
        if (!filePath) return null
        await writeArticle(filePath, source, pageInfo)
        addRecentFile(filePath)
        buildMenu(mainWindow)
        return filePath
      }
    )

    ipcMain.handle('file:get-recent', () => getRecentFiles())

    ipcMain.handle('autosave:write', (_event, input: AutosaveInput) => writeAutosave(input))

    ipcMain.handle(
      'autosave:clear',
      (_event, input: { draftId: string; filePath: string | null }) => clearAutosave(input)
    )

    ipcMain.handle('autosave:check-file', (_event, filePath: string) => checkFileAutosave(filePath))

    ipcMain.handle('autosave:list-orphans', () => listOrphanAutosaves())

    ipcMain.handle('snapshot:write', (_event, input: SnapshotInput) => writeSnapshot(input))

    ipcMain.handle('snapshot:list', (_event, filePath: string) => listSnapshots(filePath))

    ipcMain.handle('snapshot:read', (_event, filePath: string, id: string) =>
      readSnapshot(filePath, id)
    )

    ipcMain.handle(
      'autosave:confirm-recovery',
      async (_event, label: string, record: AutosaveRecord) => {
        if (!mainWindow) return 'discard'
        const savedAt = new Date(record.savedAt).toLocaleString()
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Recover', 'Discard'],
          defaultId: 0,
          cancelId: 1,
          message: `Unsaved changes found for ${label}`,
          detail: `An autosaved backup from ${savedAt} is newer than what's on disk. Recover it?`
        })
        return response === 0 ? 'recover' : 'discard'
      }
    )

    ipcMain.on('app:set-dirty', (_event, dirty: boolean) => {
      isDirty = dirty
    })

    ipcMain.handle('dialog:confirm-discard', async () => {
      if (!mainWindow) return 'cancel'
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'You have unsaved changes. Save before continuing?'
      })
      if (response === 0) return 'save'
      if (response === 1) return 'discard'
      return 'cancel'
    })

    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
