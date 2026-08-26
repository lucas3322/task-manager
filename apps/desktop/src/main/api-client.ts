import type { CreateTaskInput, Task, UpdateTaskInput, WorkspaceSnapshot } from '@orbitask/contracts'

const baseUrl = (process.env.ORBITASK_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `Erro da API (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const apiClient = {
  getSnapshot: () => request<WorkspaceSnapshot>('/workspace/snapshot'),
  createTask: (input: CreateTaskInput) => request<Task>('/tasks', { method:'POST', body:JSON.stringify(input) }),
  updateTask: (input: UpdateTaskInput) => request<Task>(`/tasks/${input.id}`, { method:'PATCH', body:JSON.stringify(input) }),
  trashTask: (id: string) => request<void>(`/tasks/${id}`, { method:'DELETE' }),
}
