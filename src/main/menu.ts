import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import { getRecentFiles } from './recent-files'

const isMac = process.platform === 'darwin'

export function buildMenu(mainWindow: BrowserWindow): void {
  const recentFiles = getRecentFiles()

  const openRecentSubmenu: MenuItemConstructorOptions[] =
    recentFiles.length === 0
      ? [{ label: 'No Recent Files', enabled: false }]
      : recentFiles.map((filePath) => ({
          label: basename(filePath),
          click: () => mainWindow.webContents.send('menu:open-path', filePath)
        }))

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => mainWindow.webContents.send('menu:new')
      },
      {
        label: 'Open…',
        accelerator: 'CmdOrCtrl+O',
        click: () => mainWindow.webContents.send('menu:open')
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => mainWindow.webContents.send('menu:save')
      },
      {
        label: 'Save As…',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => mainWindow.webContents.send('menu:save-as')
      },
      { type: 'separator' },
      { label: 'Open Recent', submenu: openRecentSubmenu },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    fileMenu,
    { role: 'editMenu' },
    { role: 'viewMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
