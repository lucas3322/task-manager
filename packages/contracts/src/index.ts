export type Priority = string

export interface Status {
  id: string
  name: string
  color: string
  position: number
}

export interface ProjectOption {
  id: string
  name: string
  color: string
  position: number
}

export interface ProjectSettings {
  priorities: ProjectOption[]
  tags: ProjectOption[]
  badges: ProjectOption[]
}

export interface ProjectPreferences {
  cardDensity: 'compact' | 'detailed'
  defaultView: 'board' | 'list'
}

export interface UpdateProjectSettingsInput {
  projectId: string
  statuses: ProjectOption[]
  priorities: ProjectOption[]
  tags: ProjectOption[]
  badges: ProjectOption[]
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  description: string
  color: string
  icon: string
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
  startDate: string | null
  dueDate: string | null
  position: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  tagIds: string[]
  badgeIds: string[]
  assigneeIds: string[]
  primaryAssigneeId: string | null
  followerIds: string[]
}

export type WorkspaceRole = 'admin' | 'member' | 'guest'

export interface WorkspaceMember {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: WorkspaceRole
  projectIds: string[]
  createdAt: string
}

export interface WorkspaceInvite {
  id: string
  email: string
  role: WorkspaceRole
  projectIds: string[]
  invitedByName: string
  expiresAt: string
  createdAt: string
  inviteUrl?: string
}

export interface TaskComment {
  id: string
  taskId: string
  userId: string
  authorName: string
  body: string
  createdAt: string
}

export interface TaskAttachment {
  id: string
  taskId: string
  name: string
  url: string
  createdAt: string
}

export interface TaskChecklistItem { id:string; taskId:string; title:string; completed:boolean; position:number; createdAt:string }
export interface TaskDependency { taskId:string; dependsOnTaskId:string; createdAt:string }
export type CustomFieldType = 'text'|'number'|'date'|'single'|'multi'
export interface CustomFieldOption { id:string; label:string; color:string }
export interface CustomFieldDefinition { id:string; projectId:string; name:string; type:CustomFieldType; options:CustomFieldOption[]; position:number }
export interface TaskCustomFieldValue { taskId:string; fieldId:string; value:string|number|string[]|null }

export interface TaskActivity {
  id: string
  taskId: string
  action: string
  payload: Record<string, unknown>
  authorName: string | null
  createdAt: string
}

export interface Notification {
  id: string
  taskId: string | null
  projectId: string | null
  type: string
  title: string
  message: string
  readAt: string | null
  createdAt: string
}

export interface WorkspaceSnapshot {
  workspace: Workspace
  user: User
  project: Project
  projects: Project[]
  statuses: Status[]
  tasks: Task[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
  checklistItems: TaskChecklistItem[]
  dependencies: TaskDependency[]
  customFields: CustomFieldDefinition[]
  customFieldValues: TaskCustomFieldValue[]
  activities: TaskActivity[]
  preferences: ProjectPreferences
  settings: ProjectSettings
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
}

export interface CreateTaskInput {
  projectId: string
  title: string
  statusId: string
  priority?: Priority
  parentId?: string | null
}

export interface UpdateProjectInput {
  id: string
  name?: string
  description?: string
  color?: string
  icon?: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string
  statusId?: string
  priority?: Priority
  startDate?: string | null
  dueDate?: string | null
  position?: number
  tagIds?: string[]
  badgeIds?: string[]
  assigneeIds?: string[]
  primaryAssigneeId?: string | null
  followerIds?: string[]
}

export type AutomationTrigger='task_created'|'status_changed'
export type AutomationActionType='set_status'|'set_priority'|'assign_user'|'add_tag'|'set_due_days'|'create_subtask'
export interface AutomationAction { id:string; type:AutomationActionType; value:string }
export interface ProjectAutomation { id:string;projectId:string;name:string;enabled:boolean;trigger:AutomationTrigger;triggerValue:string|null;actions:AutomationAction[];createdAt:string;updatedAt:string }
export interface AutomationRun { id:string;automationId:string;taskId:string|null;status:'success'|'error';message:string;createdAt:string }
export interface SaveAutomationInput { id?:string;projectId:string;name:string;enabled:boolean;trigger:AutomationTrigger;triggerValue?:string|null;actions:AutomationAction[] }

export type TaskSort='position'|'title'|'due_date'|'priority'|'updated_at'
export type TaskGroup='status'|'priority'|'assignee'|'none'
export type DueFilter='all'|'overdue'|'today'|'week'|'no_due'
export interface AdvancedTaskFilter { query:string;statusIds:string[];priorityIds:string[];assigneeIds:string[];due:DueFilter;sort:TaskSort;direction:'asc'|'desc';group:TaskGroup }
export interface SavedTaskFilter { id:string;userId:string;projectId:string;name:string;filter:AdvancedTaskFilter;createdAt:string;updatedAt:string }
export interface SaveTaskFilterInput { id?:string;projectId:string;name:string;filter:AdvancedTaskFilter }
export interface GlobalSearchTask { id:string;projectId:string;projectName:string;title:string;description:string;statusName:string;statusColor:string;dueDate:string|null }
export interface GlobalSearchProject { id:string;name:string;description:string;color:string;icon:string }
export interface GlobalSearchPerson { id:string;name:string;email:string;avatarUrl:string|null }
export interface GlobalSearchResult { tasks:GlobalSearchTask[];projects:GlobalSearchProject[];people:GlobalSearchPerson[];recent:string[] }

export interface DashboardProjectMetric { id:string;name:string;color:string;icon:string;total:number;completed:number;overdue:number;progress:number }
export interface DashboardReport {
  totals:{projects:number;tasks:number;active:number;completed:number;overdue:number;dueSoon:number}
  byStatus:{id:string;name:string;color:string;count:number}[]
  byPriority:{id:string;name:string;color:string;count:number}[]
  byAssignee:{id:string;name:string;avatarUrl:string|null;count:number;completed:number;overdue:number}[]
  projects:DashboardProjectMetric[]
}
export type PortfolioHealth='on_track'|'at_risk'|'off_track'|'on_hold'
export interface Portfolio { id:string;workspaceId:string;name:string;description:string;color:string;ownerId:string|null;startDate:string|null;dueDate:string|null;projectIds:string[];health:PortfolioHealth;createdAt:string;updatedAt:string }
export interface SavePortfolioInput { id?:string;name:string;description?:string;color:string;ownerId?:string|null;startDate?:string|null;dueDate?:string|null;projectIds:string[];health?:PortfolioHealth }
export type GoalStatus='not_started'|'on_track'|'at_risk'|'completed'
export interface Goal { id:string;workspaceId:string;title:string;description:string;status:GoalStatus;progress:number;ownerId:string|null;dueDate:string|null;projectIds:string[];createdAt:string;updatedAt:string }
export interface SaveGoalInput { id?:string;title:string;description?:string;status:GoalStatus;progress:number;ownerId?:string|null;dueDate?:string|null;projectIds:string[] }
export interface PortfolioOverview { portfolios:Portfolio[];goals:Goal[];projectMetrics:DashboardProjectMetric[] }

export interface OrbitaskApi {
  getSession(): Promise<AuthSession | null>
  signUp(input: SignUpInput): Promise<AuthSession>
  signIn(input: SignInInput): Promise<AuthSession>
  signOut(): Promise<void>
  getSnapshot(projectId?: string): Promise<WorkspaceSnapshot>
  createProject(input: { name: string; color?: string }): Promise<Project>
  updateProject(input: UpdateProjectInput): Promise<Project>
  updateProjectSettings(input: UpdateProjectSettingsInput): Promise<WorkspaceSnapshot>
  updateProjectPreferences(input: { projectId: string; cardDensity?: ProjectPreferences['cardDensity']; defaultView?: ProjectPreferences['defaultView'] }): Promise<ProjectPreferences>
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(input: UpdateTaskInput): Promise<Task>
  moveTask(input: { id: string; statusId: string; position: number }): Promise<Task>
  trashTask(id: string): Promise<void>
  createComment(input: { taskId: string; body: string }): Promise<TaskComment>
  addAttachment(input: { taskId: string; name: string; url: string }): Promise<TaskAttachment>
  removeAttachment(id: string): Promise<void>
  createChecklistItem(input:{taskId:string;title:string}):Promise<TaskChecklistItem>
  updateChecklistItem(input:{id:string;title?:string;completed?:boolean}):Promise<TaskChecklistItem>
  removeChecklistItem(id:string):Promise<void>
  addDependency(input:{taskId:string;dependsOnTaskId:string}):Promise<TaskDependency>
  removeDependency(input:{taskId:string;dependsOnTaskId:string}):Promise<void>
  updateCustomFields(input:{projectId:string;fields:CustomFieldDefinition[]}):Promise<CustomFieldDefinition[]>
  setTaskCustomField(input:{taskId:string;fieldId:string;value:string|number|string[]|null}):Promise<TaskCustomFieldValue>
  listMembers(): Promise<{ members:WorkspaceMember[]; invites:WorkspaceInvite[] }>
  createInvite(input:{email:string;role:WorkspaceRole;projectIds:string[]}):Promise<WorkspaceInvite>
  revokeInvite(id:string):Promise<void>
  updateMember(input:{userId:string;role:WorkspaceRole;projectIds:string[]}):Promise<WorkspaceMember>
  removeMember(userId:string):Promise<void>
  updateProfile(input:{name:string;avatarUrl?:string|null}):Promise<User>
  listNotifications():Promise<Notification[]>
  markNotificationRead(id:string):Promise<void>
  markAllNotificationsRead():Promise<void>
  listAutomations(projectId:string):Promise<{automations:ProjectAutomation[];runs:AutomationRun[]}>
  saveAutomation(input:SaveAutomationInput):Promise<ProjectAutomation>
  removeAutomation(id:string):Promise<void>
  searchGlobal(query:string):Promise<GlobalSearchResult>
  listSavedFilters(projectId:string):Promise<SavedTaskFilter[]>
  saveTaskFilter(input:SaveTaskFilterInput):Promise<SavedTaskFilter>
  removeSavedFilter(id:string):Promise<void>
  getDashboard():Promise<DashboardReport>
  getPortfolioOverview():Promise<PortfolioOverview>
  savePortfolio(input:SavePortfolioInput):Promise<Portfolio>
  removePortfolio(id:string):Promise<void>
  saveGoal(input:SaveGoalInput):Promise<Goal>
  removeGoal(id:string):Promise<void>
}

export interface User { id: string; name: string; email: string; avatarUrl: string | null; createdAt: string }
export interface Workspace { id: string; name: string; role: WorkspaceRole }
export interface AuthSession { user: User; workspace: Workspace }
export interface SignUpInput { name: string; email: string; password: string; workspaceName?: string }
export interface SignInInput { email: string; password: string }
