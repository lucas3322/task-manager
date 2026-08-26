export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Status {
  id: string
  name: string
  color: string
  position: number
}

export interface Project {
  id: string
  workspaceId: string
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
  workspace: Workspace
  user: User
  project: Project
  projects: Project[]
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
  getSession(): Promise<AuthSession | null>
  signUp(input: SignUpInput): Promise<AuthSession>
  signIn(input: SignInInput): Promise<AuthSession>
  signOut(): Promise<void>
  getSnapshot(projectId?: string): Promise<WorkspaceSnapshot>
  createProject(input: { name: string; color?: string }): Promise<Project>
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(input: UpdateTaskInput): Promise<Task>
  moveTask(input: { id: string; statusId: string; position: number }): Promise<Task>
  trashTask(id: string): Promise<void>
}

export interface User { id: string; name: string; email: string; createdAt: string }
export interface Workspace { id: string; name: string; role: 'admin' | 'member' | 'guest' }
export interface AuthSession { user: User; workspace: Workspace }
export interface SignUpInput { name: string; email: string; password: string; workspaceName?: string }
export interface SignInInput { email: string; password: string }
