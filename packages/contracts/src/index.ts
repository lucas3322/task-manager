export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Status {
  id: string
  name: string
  color: string
  position: number
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
}

export interface Task {
  id: string
  projectId: string
  parentId: string | null
  title: string
  description: string
  statusId: string
  priority: Priority
  dueDate: string | null
  position: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceSnapshot {
  project: Project
  statuses: Status[]
  tasks: Task[]
}

export interface CreateTaskInput {
  projectId: string
  title: string
  statusId: string
  priority?: Priority
  parentId?: string | null
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string
  statusId?: string
  priority?: Priority
  dueDate?: string | null
  position?: number
}

export interface OrbitaskApi {
  getSnapshot(): Promise<WorkspaceSnapshot>
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(input: UpdateTaskInput): Promise<Task>
  moveTask(input: { id: string; statusId: string; position: number }): Promise<Task>
  trashTask(id: string): Promise<void>
}
