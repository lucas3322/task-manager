import type {
  AuthSession,
  AutomationRun,
  CreateTaskInput,
  DashboardReport,
  GlobalSearchResult,
  MyTask,
  Project,
  ProjectAutomation,
  Task,
  TaskChecklistItem,
  TaskComment,
  TaskDependency,
  UpdateTaskInput,
  WorkspaceSnapshot,
} from '@orbitask/contracts'

export class OrbitaskApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** Cliente HTTP mínimo da API do Orbitask, autenticado com um token de acesso pessoal. */
export class OrbitaskClient {
  private readonly root: string
  private readonly snapshots = new Map<string, { at: number; value: WorkspaceSnapshot }>()

  constructor(apiUrl: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {
    this.root = apiUrl.replace(/\/$/, '')
  }

  private async request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    let response: Response
    try {
      response = await this.fetcher(`${this.root}${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          'User-Agent': 'orbitask-mcp',
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      })
    } catch (error) {
      throw new OrbitaskApiError(`Não foi possível conectar à API do Orbitask em ${this.root} (${error instanceof Error ? error.message : 'erro de rede'})`, 0)
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null
      const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message
      if (response.status === 401) throw new OrbitaskApiError(`${message ?? 'Não autorizado'}. Gere um novo token em Ajustes › Integrações e MCP.`, 401)
      throw new OrbitaskApiError(message ?? `Erro da API (${response.status})`, response.status)
    }
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  /** Snapshot completo do projeto; reaproveitado por alguns segundos entre chamadas seguidas. */
  async snapshot(projectId?: string, fresh = false): Promise<WorkspaceSnapshot> {
    const key = projectId ?? ''
    const cached = this.snapshots.get(key)
    if (!fresh && cached && Date.now() - cached.at < 5_000) return cached.value
    const value = await this.request<WorkspaceSnapshot>(`/workspace/snapshot${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`)
    this.snapshots.set(key, { at: Date.now(), value })
    this.snapshots.set(value.project.id, { at: Date.now(), value })
    return value
  }

  invalidate() {
    this.snapshots.clear()
  }

  me = () => this.request<AuthSession>('/auth/me')
  projects = () => this.request<Project[]>('/projects')
  search = (query: string) => this.request<GlobalSearchResult>(`/search?q=${encodeURIComponent(query)}`)
  myTasks = () => this.request<MyTask[]>('/me/tasks')
  dashboard = () => this.request<DashboardReport>('/reports/dashboard')
  automations = (projectId: string) => this.request<{ automations: ProjectAutomation[]; runs: AutomationRun[] }>(`/automations?projectId=${encodeURIComponent(projectId)}`)

  private async write<T>(promise: Promise<T>) {
    const result = await promise
    this.invalidate()
    return result
  }
  createTask = (input: CreateTaskInput) => this.write(this.request<Task>('/tasks', { method: 'POST', body: input }))
  updateTask = (input: UpdateTaskInput) => {
    const { id, ...body } = input
    return this.write(this.request<Task>(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body }))
  }
  trashTask = (id: string) => this.write(this.request<void>(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  comment = (taskId: string, body: string) => this.write(this.request<TaskComment>(`/tasks/${encodeURIComponent(taskId)}/comments`, { method: 'POST', body: { body } }))
  addChecklistItem = (taskId: string, title: string) => this.write(this.request<TaskChecklistItem>(`/tasks/${encodeURIComponent(taskId)}/checklist`, { method: 'POST', body: { title } }))
  updateChecklistItem = (id: string, input: { title?: string; completed?: boolean }) => this.write(this.request<TaskChecklistItem>(`/checklist/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }))
  addDependency = (taskId: string, dependsOnTaskId: string) => this.write(this.request<TaskDependency>(`/tasks/${encodeURIComponent(taskId)}/dependencies`, { method: 'POST', body: { dependsOnTaskId } }))
}
