import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { apiClient } from './api-client'
import { checkForUpdates, downloadAndInstall, openLatestRelease } from './updater'
import type { CreateTaskInput, UpdateProjectInput, UpdateProjectSettingsInput, UpdateTaskInput } from '@orbitask/contracts'

app.setName('Orbitask')

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    ...(process.platform === 'darwin'
      ? { vibrancy: 'sidebar' as const, visualEffectState: 'followWindow' as const, backgroundColor: '#00000000' }
      : { backgroundColor: nativeTheme.shouldUseDarkColors ? '#161618' : '#f5f5f7' }),
    title: 'Orbitask',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' } })
  window.webContents.on('console-message',(_event,level,message,line,sourceId)=>{if(level>=2)console.error(`[renderer:${level}] ${message} (${sourceId}:${line})`)})
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
  ipcMain.handle('project:update',(_event,input:UpdateProjectInput)=>apiClient.updateProject(input))
  ipcMain.handle('project:settings',(_event,input:UpdateProjectSettingsInput)=>apiClient.updateProjectSettings(input))
  ipcMain.handle('project:preferences',(_event,input)=>apiClient.updateProjectPreferences(input))
  ipcMain.handle('project:select',(_event,id:string)=>apiClient.getSnapshot(id))
  ipcMain.handle('task:create', (_event, input: CreateTaskInput) => apiClient.createTask(input))
  ipcMain.handle('task:update', (_event, input: UpdateTaskInput) => apiClient.updateTask(input))
  ipcMain.handle('task:move', (_event, input: { id: string; statusId: string; position: number }) => apiClient.updateTask(input))
  ipcMain.handle('task:trash', (_event, id: string) => apiClient.trashTask(id))
  ipcMain.handle('task:comment',(_event,input)=>apiClient.createComment(input))
  ipcMain.handle('task:attachment:add',(_event,input)=>apiClient.addAttachment(input))
  ipcMain.handle('task:attachment:remove',(_event,id:string)=>apiClient.removeAttachment(id))
  ipcMain.handle('task:checklist:create',(_event,input)=>apiClient.createChecklistItem(input))
  ipcMain.handle('task:checklist:update',(_event,input)=>apiClient.updateChecklistItem(input))
  ipcMain.handle('task:checklist:remove',(_event,id:string)=>apiClient.removeChecklistItem(id))
  ipcMain.handle('task:dependency:add',(_event,input)=>apiClient.addDependency(input))
  ipcMain.handle('task:dependency:remove',(_event,input)=>apiClient.removeDependency(input))
  ipcMain.handle('project:custom-fields',(_event,input)=>apiClient.updateCustomFields(input))
  ipcMain.handle('task:custom-field:set',(_event,input)=>apiClient.setTaskCustomField(input))
  ipcMain.handle('workspace:members',()=>apiClient.listMembers())
  ipcMain.handle('workspace:invite:create',(_event,input)=>apiClient.createInvite(input))
  ipcMain.handle('workspace:invite:revoke',(_event,id:string)=>apiClient.revokeInvite(id))
  ipcMain.handle('workspace:member:update',(_event,input)=>apiClient.updateMember(input))
  ipcMain.handle('workspace:member:remove',(_event,userId:string)=>apiClient.removeMember(userId))
  ipcMain.handle('profile:update',(_event,input)=>apiClient.updateProfile(input))
  ipcMain.handle('notifications:list',()=>apiClient.listNotifications())
  ipcMain.handle('notifications:read',(_event,id:string)=>apiClient.markNotificationRead(id))
  ipcMain.handle('notifications:read-all',()=>apiClient.markAllNotificationsRead())
  ipcMain.handle('automations:list',(_event,projectId:string)=>apiClient.listAutomations(projectId))
  ipcMain.handle('automations:save',(_event,input)=>apiClient.saveAutomation(input))
  ipcMain.handle('automations:remove',(_event,id:string)=>apiClient.removeAutomation(id))
  ipcMain.handle('search:global',(_event,query:string)=>apiClient.searchGlobal(query))
  ipcMain.handle('filters:list',(_event,projectId:string)=>apiClient.listSavedFilters(projectId))
  ipcMain.handle('filters:save',(_event,input)=>apiClient.saveTaskFilter(input))
  ipcMain.handle('filters:remove',(_event,id:string)=>apiClient.removeSavedFilter(id))
  ipcMain.handle('reports:dashboard',()=>apiClient.getDashboard())
  ipcMain.handle('portfolio:overview',()=>apiClient.getPortfolioOverview())
  ipcMain.handle('portfolio:save',(_event,input)=>apiClient.savePortfolio(input))
  ipcMain.handle('portfolio:remove',(_event,id:string)=>apiClient.removePortfolio(id))
  ipcMain.handle('goal:save',(_event,input)=>apiClient.saveGoal(input))
  ipcMain.handle('goal:remove',(_event,id:string)=>apiClient.removeGoal(id))
  ipcMain.handle('auth:password',(_event,input)=>apiClient.changePassword(input))
  ipcMain.handle('auth:signout-others',()=>apiClient.signOutOtherSessions())
  ipcMain.handle('workspace:update',(_event,input)=>apiClient.updateWorkspace(input))
  ipcMain.handle('project:remove',(_event,id:string)=>apiClient.removeProject(id))
  ipcMain.handle('task:trash:list',(_event,projectId:string)=>apiClient.listTrash(projectId))
  ipcMain.handle('task:mine',()=>apiClient.listMyTasks())
  ipcMain.handle('task:restore',(_event,id:string)=>apiClient.restoreTask(id))
  ipcMain.handle('updates:check',()=>checkForUpdates())
  ipcMain.handle('updates:install',(event)=>downloadAndInstall((progress)=>{if(!event.sender.isDestroyed())event.sender.send('updates:progress',progress)}))
  ipcMain.handle('updates:release-page',()=>openLatestRelease())
  ipcMain.handle('app:theme',(_event,source:'system'|'light'|'dark')=>{if(['system','light','dark'].includes(source))nativeTheme.themeSource=source})
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
