import { contextBridge, ipcRenderer } from 'electron'
import type { CreateTaskInput, OrbitaskApi, UpdateTaskInput } from '@orbitask/contracts'

const api: OrbitaskApi = {
  getSession:()=>ipcRenderer.invoke('auth:session'),
  signUp:(input)=>ipcRenderer.invoke('auth:signup',input),
  signIn:(input)=>ipcRenderer.invoke('auth:signin',input),
  signOut:()=>ipcRenderer.invoke('auth:signout'),
  getSnapshot: (projectId?:string) => projectId ? ipcRenderer.invoke('project:select',projectId) : ipcRenderer.invoke('workspace:snapshot'),
  createProject:(input)=>ipcRenderer.invoke('project:create',input),
  createTask: (input: CreateTaskInput) => ipcRenderer.invoke('task:create', input),
  updateTask: (input: UpdateTaskInput) => ipcRenderer.invoke('task:update', input),
  moveTask: (input) => ipcRenderer.invoke('task:move', input),
  trashTask: (id: string) => ipcRenderer.invoke('task:trash', id),
}

contextBridge.exposeInMainWorld('orbitask', api)
