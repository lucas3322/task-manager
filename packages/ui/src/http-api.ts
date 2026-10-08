import type {
  AuthSession,
  AutomationRun,
  ChangePasswordInput,
  CreateTaskInput,
  CustomFieldDefinition,
  DashboardReport,
  GlobalSearchResult,
  Goal,
  InviteDetails,
  MyTask,
  Notification,
  OrbitaskApi,
  Portfolio,
  PortfolioOverview,
  Project,
  ProjectAutomation,
  ProjectPreferences,
  SavedTaskFilter,
  SaveAutomationInput,
  SaveGoalInput,
  SavePortfolioInput,
  SaveTaskFilterInput,
  SignInInput,
  SignUpInput,
  Task,
  TaskAttachment,
  TaskChecklistItem,
  TaskComment,
  TaskCustomFieldValue,
  TaskDependency,
  UpdateProjectInput,
  UpdateProjectSettingsInput,
  UpdateTaskInput,
  User,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSnapshot,
} from "@orbitask/contracts";

const TOKEN_KEY = "orbitask_token";

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* armazenamento indisponível: a sessão dura apenas esta aba */
  }
}

/** Cliente HTTP da API Orbitask para o navegador, com a mesma interface usada pelo Desktop. */
export function createHttpApi(baseUrl: string): OrbitaskApi {
  const root = baseUrl.replace(/\/$/, "");
  let memoryToken = readToken();
  const setToken = (token: string | null) => {
    memoryToken = token;
    writeToken(token);
  };

  async function request<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
    const token = authenticated ? memoryToken : null;
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
      throw new Error(message ?? `Erro da API (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const authenticate = async (path: string, input: unknown) => {
    const result = await request<{ token: string; session: AuthSession }>(path, json("POST", input), false);
    setToken(result.token);
    return result.session;
  };

  return {
    getSession: async () => {
      if (!memoryToken) return null;
      try {
        return await request<AuthSession>("/auth/me");
      } catch {
        setToken(null);
        return null;
      }
    },
    signUp: (input: SignUpInput) => authenticate("/auth/signup", input),
    signIn: (input: SignInInput) => authenticate("/auth/login", input),
    signOut: async () => {
      try {
        await request("/auth/logout", json("POST"));
      } finally {
        setToken(null);
      }
    },
    getSnapshot: (projectId?: string) =>
      request<WorkspaceSnapshot>(`/workspace/snapshot${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
    createProject: (input: { name: string; color?: string }) => request<Project>("/projects", json("POST", input)),
    updateProject: (input: UpdateProjectInput) => request<Project>(`/projects/${input.id}`, json("PATCH", input)),
    updateProjectSettings: async (input: UpdateProjectSettingsInput) => {
      await request(`/projects/${input.projectId}/settings`, json("PATCH", input));
      return request<WorkspaceSnapshot>(`/workspace/snapshot?projectId=${encodeURIComponent(input.projectId)}`);
    },
    updateProjectPreferences: (input: {
      projectId: string;
      cardDensity?: ProjectPreferences["cardDensity"];
      defaultView?: ProjectPreferences["defaultView"];
    }) => request<ProjectPreferences>(`/projects/${input.projectId}/preferences`, json("PATCH", input)),
    createTask: (input: CreateTaskInput) => request<Task>("/tasks", json("POST", input)),
    updateTask: (input: UpdateTaskInput) => request<Task>(`/tasks/${input.id}`, json("PATCH", input)),
    moveTask: (input: { id: string; statusId: string; position: number }) =>
      request<Task>(`/tasks/${input.id}`, json("PATCH", input)),
    trashTask: (id: string) => request<void>(`/tasks/${id}`, json("DELETE")),
    createComment: (input: { taskId: string; body: string }) =>
      request<TaskComment>(`/tasks/${input.taskId}/comments`, json("POST", { body: input.body })),
    addAttachment: (input: { taskId: string; name: string; url: string }) =>
      request<TaskAttachment>(`/tasks/${input.taskId}/attachments`, json("POST", { name: input.name, url: input.url })),
    removeAttachment: (id: string) => request<void>(`/attachments/${id}`, json("DELETE")),
    createChecklistItem: (input: { taskId: string; title: string }) =>
      request<TaskChecklistItem>(`/tasks/${input.taskId}/checklist`, json("POST", { title: input.title })),
    updateChecklistItem: (input: { id: string; title?: string; completed?: boolean }) =>
      request<TaskChecklistItem>(`/checklist/${input.id}`, json("PATCH", input)),
    removeChecklistItem: (id: string) => request<void>(`/checklist/${id}`, json("DELETE")),
    addDependency: (input: { taskId: string; dependsOnTaskId: string }) =>
      request<TaskDependency>(`/tasks/${input.taskId}/dependencies`, json("POST", { dependsOnTaskId: input.dependsOnTaskId })),
    removeDependency: (input: { taskId: string; dependsOnTaskId: string }) =>
      request<void>(`/tasks/${input.taskId}/dependencies/${input.dependsOnTaskId}`, json("DELETE")),
    updateCustomFields: (input: { projectId: string; fields: CustomFieldDefinition[] }) =>
      request<CustomFieldDefinition[]>(`/projects/${input.projectId}/custom-fields`, json("PATCH", { fields: input.fields })),
    setTaskCustomField: (input: { taskId: string; fieldId: string; value: string | number | string[] | null }) =>
      request<TaskCustomFieldValue>(`/tasks/${input.taskId}/custom-fields/${input.fieldId}`, json("PATCH", { value: input.value })),
    listMembers: () => request<{ members: WorkspaceMember[]; invites: WorkspaceInvite[] }>("/workspace/members"),
    createInvite: (input: { email: string; role: WorkspaceRole; projectIds: string[] }) =>
      request<WorkspaceInvite>("/workspace/invites", json("POST", input)),
    revokeInvite: (id: string) => request<void>(`/workspace/invites/${id}`, json("DELETE")),
    updateMember: (input: { userId: string; role: WorkspaceRole; projectIds: string[] }) =>
      request<WorkspaceMember>(`/workspace/members/${input.userId}`, json("PATCH", input)),
    removeMember: (userId: string) => request<void>(`/workspace/members/${userId}`, json("DELETE")),
    updateProfile: (input: { name: string; avatarUrl?: string | null }) => request<User>("/profile", json("PATCH", input)),
    listNotifications: () => request<Notification[]>("/notifications"),
    markNotificationRead: (id: string) => request<void>(`/notifications/${id}/read`, json("PATCH")),
    markAllNotificationsRead: () => request<void>("/notifications/read-all", json("PATCH")),
    listAutomations: (projectId: string) =>
      request<{ automations: ProjectAutomation[]; runs: AutomationRun[] }>(`/automations?projectId=${encodeURIComponent(projectId)}`),
    saveAutomation: (input: SaveAutomationInput) => request<ProjectAutomation>("/automations", json("POST", input)),
    removeAutomation: (id: string) => request<void>(`/automations/${id}`, json("DELETE")),
    searchGlobal: (query: string) => request<GlobalSearchResult>(`/search?q=${encodeURIComponent(query)}`),
    listSavedFilters: (projectId: string) =>
      request<SavedTaskFilter[]>(`/saved-filters?projectId=${encodeURIComponent(projectId)}`),
    saveTaskFilter: (input: SaveTaskFilterInput) => request<SavedTaskFilter>("/saved-filters", json("POST", input)),
    removeSavedFilter: (id: string) => request<void>(`/saved-filters/${id}`, json("DELETE")),
    getDashboard: () => request<DashboardReport>("/reports/dashboard"),
    getPortfolioOverview: () => request<PortfolioOverview>("/portfolio-overview"),
    savePortfolio: (input: SavePortfolioInput) => request<Portfolio>("/portfolios", json("POST", input)),
    removePortfolio: (id: string) => request<void>(`/portfolios/${id}`, json("DELETE")),
    saveGoal: (input: SaveGoalInput) => request<Goal>("/goals", json("POST", input)),
    removeGoal: (id: string) => request<void>(`/goals/${id}`, json("DELETE")),
    changePassword: (input: ChangePasswordInput) => request<{ revoked: number }>("/auth/password", json("PATCH", input)),
    signOutOtherSessions: () => request<{ revoked: number }>("/auth/logout-others", json("POST")),
    updateWorkspace: (input: { name: string }) => request<Workspace>("/workspace", json("PATCH", input)),
    removeProject: (id: string) => request<void>(`/projects/${id}`, json("DELETE")),
    listTrash: (projectId: string) => request<Task[]>(`/projects/${encodeURIComponent(projectId)}/trash`),
    restoreTask: (id: string) => request<void>(`/tasks/${id}/restore`, json("POST")),
    listMyTasks: () => request<MyTask[]>("/me/tasks"),
    inspectInvite: (token: string) => request<InviteDetails>(`/invites/${encodeURIComponent(token)}`, undefined, false),
    acceptInvite: (token: string, input: { name: string; password: string }) =>
      authenticate(`/invites/${encodeURIComponent(token)}/accept`, input),
  };
}
