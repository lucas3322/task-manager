import type { AuthSession, AutomationRun, CreateTaskInput, CustomFieldDefinition, DashboardReport, GlobalSearchResult, Notification, Portfolio, PortfolioOverview, Project, ProjectAutomation, ProjectPreferences, SavedTaskFilter, SaveAutomationInput, SaveGoalInput, SavePortfolioInput, SaveTaskFilterInput, SignInInput, SignUpInput, Task, TaskAttachment, TaskChecklistItem, TaskComment, TaskCustomFieldValue, TaskDependency, User, WorkspaceInvite, WorkspaceMember, WorkspaceRole, UpdateProjectInput, UpdateProjectSettingsInput, UpdateTaskInput, WorkspaceSnapshot, Goal } from '@orbitask/contracts'
import { clearToken, loadToken, saveToken } from './session-store'

const baseUrl = (process.env.ORBITASK_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit, authenticated=true): Promise<T> {
  const token=authenticated ? await loadToken() : null
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
  signUp: async(input:SignUpInput)=>{await clearToken();const result=await request<{token:string;session:AuthSession}>('/auth/signup',{method:'POST',body:JSON.stringify(input)},false);await saveToken(result.token);return result.session},
  signIn: async(input:SignInInput)=>{await clearToken();const result=await request<{token:string;session:AuthSession}>('/auth/login',{method:'POST',body:JSON.stringify(input)},false);await saveToken(result.token);return result.session},
  signOut: async()=>{try{await request('/auth/logout',{method:'POST'})}finally{await clearToken()}},
  getSnapshot: (projectId?:string) => request<WorkspaceSnapshot>(`/workspace/snapshot${projectId?`?projectId=${encodeURIComponent(projectId)}`:''}`),
  createProject:(input:{name:string;color?:string})=>request<Project>('/projects',{method:'POST',body:JSON.stringify(input)}),
  updateProject:(input:UpdateProjectInput)=>request<Project>(`/projects/${input.id}`,{method:'PATCH',body:JSON.stringify(input)}),
  updateProjectSettings:async(input:UpdateProjectSettingsInput)=>{await request(`/projects/${input.projectId}/settings`,{method:'PATCH',body:JSON.stringify(input)});return request<WorkspaceSnapshot>(`/workspace/snapshot?projectId=${encodeURIComponent(input.projectId)}`)},
  updateProjectPreferences:(input:{projectId:string;cardDensity?:ProjectPreferences['cardDensity'];defaultView?:ProjectPreferences['defaultView']})=>request<ProjectPreferences>(`/projects/${input.projectId}/preferences`,{method:'PATCH',body:JSON.stringify(input)}),
  createTask: (input: CreateTaskInput) => request<Task>('/tasks', { method:'POST', body:JSON.stringify(input) }),
  updateTask: (input: UpdateTaskInput) => request<Task>(`/tasks/${input.id}`, { method:'PATCH', body:JSON.stringify(input) }),
  trashTask: (id: string) => request<void>(`/tasks/${id}`, { method:'DELETE' }),
  createComment:(input:{taskId:string;body:string})=>request<TaskComment>(`/tasks/${input.taskId}/comments`,{method:'POST',body:JSON.stringify({body:input.body})}),
  addAttachment:(input:{taskId:string;name:string;url:string})=>request<TaskAttachment>(`/tasks/${input.taskId}/attachments`,{method:'POST',body:JSON.stringify({name:input.name,url:input.url})}),
  removeAttachment:(id:string)=>request<void>(`/attachments/${id}`,{method:'DELETE'}),
  createChecklistItem:(input:{taskId:string;title:string})=>request<TaskChecklistItem>(`/tasks/${input.taskId}/checklist`,{method:'POST',body:JSON.stringify({title:input.title})}),
  updateChecklistItem:(input:{id:string;title?:string;completed?:boolean})=>request<TaskChecklistItem>(`/checklist/${input.id}`,{method:'PATCH',body:JSON.stringify(input)}),
  removeChecklistItem:(id:string)=>request<void>(`/checklist/${id}`,{method:'DELETE'}),
  addDependency:(input:{taskId:string;dependsOnTaskId:string})=>request<TaskDependency>(`/tasks/${input.taskId}/dependencies`,{method:'POST',body:JSON.stringify({dependsOnTaskId:input.dependsOnTaskId})}),
  removeDependency:(input:{taskId:string;dependsOnTaskId:string})=>request<void>(`/tasks/${input.taskId}/dependencies/${input.dependsOnTaskId}`,{method:'DELETE'}),
  updateCustomFields:(input:{projectId:string;fields:CustomFieldDefinition[]})=>request<CustomFieldDefinition[]>(`/projects/${input.projectId}/custom-fields`,{method:'PATCH',body:JSON.stringify({fields:input.fields})}),
  setTaskCustomField:(input:{taskId:string;fieldId:string;value:string|number|string[]|null})=>request<TaskCustomFieldValue>(`/tasks/${input.taskId}/custom-fields/${input.fieldId}`,{method:'PATCH',body:JSON.stringify({value:input.value})}),
  listMembers:()=>request<{members:WorkspaceMember[];invites:WorkspaceInvite[]}>('/workspace/members'),
  createInvite:(input:{email:string;role:WorkspaceRole;projectIds:string[]})=>request<WorkspaceInvite>('/workspace/invites',{method:'POST',body:JSON.stringify(input)}),
  revokeInvite:(id:string)=>request<void>(`/workspace/invites/${id}`,{method:'DELETE'}),
  updateMember:(input:{userId:string;role:WorkspaceRole;projectIds:string[]})=>request<WorkspaceMember>(`/workspace/members/${input.userId}`,{method:'PATCH',body:JSON.stringify(input)}),
  removeMember:(userId:string)=>request<void>(`/workspace/members/${userId}`,{method:'DELETE'}),
  updateProfile:(input:{name:string;avatarUrl?:string|null})=>request<User>('/profile',{method:'PATCH',body:JSON.stringify(input)}),
  listNotifications:()=>request<Notification[]>('/notifications'),
  markNotificationRead:(id:string)=>request<void>(`/notifications/${id}/read`,{method:'PATCH'}),
  markAllNotificationsRead:()=>request<void>('/notifications/read-all',{method:'PATCH'}),
  listAutomations:(projectId:string)=>request<{automations:ProjectAutomation[];runs:AutomationRun[]}>(`/automations?projectId=${encodeURIComponent(projectId)}`),
  saveAutomation:(input:SaveAutomationInput)=>request<ProjectAutomation>('/automations',{method:'POST',body:JSON.stringify(input)}),
  removeAutomation:(id:string)=>request<void>(`/automations/${id}`,{method:'DELETE'}),
  searchGlobal:(query:string)=>request<GlobalSearchResult>(`/search?q=${encodeURIComponent(query)}`),
  listSavedFilters:(projectId:string)=>request<SavedTaskFilter[]>(`/saved-filters?projectId=${encodeURIComponent(projectId)}`),
  saveTaskFilter:(input:SaveTaskFilterInput)=>request<SavedTaskFilter>('/saved-filters',{method:'POST',body:JSON.stringify(input)}),
  removeSavedFilter:(id:string)=>request<void>(`/saved-filters/${id}`,{method:'DELETE'}),
  getDashboard:()=>request<DashboardReport>('/reports/dashboard'),
  getPortfolioOverview:()=>request<PortfolioOverview>('/portfolio-overview'),
  savePortfolio:(input:SavePortfolioInput)=>request<Portfolio>('/portfolios',{method:'POST',body:JSON.stringify(input)}),
  removePortfolio:(id:string)=>request<void>(`/portfolios/${id}`,{method:'DELETE'}),
  saveGoal:(input:SaveGoalInput)=>request<Goal>('/goals',{method:'POST',body:JSON.stringify(input)}),
  removeGoal:(id:string)=>request<void>(`/goals/${id}`,{method:'DELETE'}),
}
