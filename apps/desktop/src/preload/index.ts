import { contextBridge, ipcRenderer } from 'electron'
import type { CreateTaskInput, OrbitaskApi, UpdateTaskInput } from '@orbitask/contracts'

const api: OrbitaskApi = {
  getSnapshot: () => ipcRenderer.invoke('workspace:snapshot'),
  createTask: (input: CreateTaskInput) => ipcRenderer.invoke('task:create', input),
  updateTask: (input: UpdateTaskInput) => ipcRenderer.invoke('task:update', input),
  moveTask: (input) => ipcRenderer.invoke('task:move', input),
  trashTask: (id: string) => ipcRenderer.invoke('task:trash', id),
}

contextBridge.exposeInMainWorld('orbitask', api)
