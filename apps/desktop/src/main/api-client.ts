import type { AuthSession, CreateTaskInput, Project, SignInInput, SignUpInput, Task, UpdateTaskInput, WorkspaceSnapshot } from '@orbitask/contracts'
import { clearToken, loadToken, saveToken } from './session-store'

const baseUrl = (process.env.ORBITASK_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token=await loadToken()
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) ,...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `Erro da API (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const apiClient = {
  getSession: async()=>{try{return await request<AuthSession>('/auth/me')}catch{return null}},
  signUp: async(input:SignUpInput)=>{const result=await request<{token:string;session:AuthSession}>('/auth/signup',{method:'POST',body:JSON.stringify(input)});await saveToken(result.token);return result.session},
  signIn: async(input:SignInInput)=>{const result=await request<{token:string;session:AuthSession}>('/auth/login',{method:'POST',body:JSON.stringify(input)});await saveToken(result.token);return result.session},
  signOut: async()=>{try{await request('/auth/logout',{method:'POST'})}finally{await clearToken()}},
  getSnapshot: (projectId?:string) => request<WorkspaceSnapshot>(`/workspace/snapshot${projectId?`?projectId=${encodeURIComponent(projectId)}`:''}`),
  createProject:(input:{name:string;color?:string})=>request<Project>('/projects',{method:'POST',body:JSON.stringify(input)}),
  createTask: (input: CreateTaskInput) => request<Task>('/tasks', { method:'POST', body:JSON.stringify(input) }),
  updateTask: (input: UpdateTaskInput) => request<Task>(`/tasks/${input.id}`, { method:'PATCH', body:JSON.stringify(input) }),
  trashTask: (id: string) => request<void>(`/tasks/${id}`, { method:'DELETE' }),
}
