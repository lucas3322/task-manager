import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { apiClient } from './api-client'
import type { CreateTaskInput, UpdateTaskInput } from '@orbitask/contracts'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f7f7fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' } })
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('workspace:snapshot', () => apiClient.getSnapshot())
  ipcMain.handle('auth:session',()=>apiClient.getSession())
  ipcMain.handle('auth:signup',(_event,input)=>apiClient.signUp(input))
  ipcMain.handle('auth:signin',(_event,input)=>apiClient.signIn(input))
  ipcMain.handle('auth:signout',()=>apiClient.signOut())
  ipcMain.handle('project:create',(_event,input)=>apiClient.createProject(input))
  ipcMain.handle('project:select',(_event,id:string)=>apiClient.getSnapshot(id))
  ipcMain.handle('task:create', (_event, input: CreateTaskInput) => apiClient.createTask(input))
  ipcMain.handle('task:update', (_event, input: UpdateTaskInput) => apiClient.updateTask(input))
  ipcMain.handle('task:move', (_event, input: { id: string; statusId: string; position: number }) => apiClient.updateTask(input))
  ipcMain.handle('task:trash', (_event, id: string) => apiClient.trashTask(id))
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
