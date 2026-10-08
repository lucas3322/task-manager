import { create } from "zustand";
import type {
  AuthSession,
  Project,
  SignInInput,
  SignUpInput,
  Task,
  UpdateProjectInput,
  UpdateTaskInput,
  WorkspaceSnapshot,
} from "@orbitask/contracts";
import { api, errorMessage, type Platform } from "./api";

export type ProjectView = "overview" | "board" | "list" | "calendar" | "timeline";
export type SettingsTab = "profile" | "security" | "appearance" | "workspace" | "shortcuts" | "about";
export type ProjectSettingsTab = "general" | "workflow" | "fields" | "automations" | "trash";
export type Route =
  | { name: "home" }
  | { name: "my-tasks" }
  | { name: "inbox" }
  | { name: "reports" }
  | { name: "strategy" }
  | { name: "people" }
  | { name: "settings"; tab: SettingsTab }
  | { name: "project"; projectId: string; view: ProjectView }
  | { name: "project-settings"; projectId: string; tab: ProjectSettingsTab };

const projectViews: Record<string, ProjectView> = {
  "visao-geral": "overview",
  quadro: "board",
  lista: "list",
  calendario: "calendar",
  cronograma: "timeline",
};
const projectViewSlugs = Object.fromEntries(Object.entries(projectViews).map(([slug, view]) => [view, slug])) as Record<
  ProjectView,
  string
>;
const settingsTabs: SettingsTab[] = ["profile", "security", "appearance", "workspace", "shortcuts", "about"];
const settingsSlugs: Record<SettingsTab, string> = {
  profile: "perfil",
  security: "seguranca",
  appearance: "aparencia",
  workspace: "workspace",
  shortcuts: "atalhos",
  about: "sobre",
};
const projectSettingsSlugs: Record<ProjectSettingsTab, string> = {
  general: "geral",
  workflow: "fluxo",
  fields: "campos",
  automations: "automacoes",
  trash: "lixeira",
};

export function routeToHash(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/inicio";
    case "my-tasks":
      return "#/minhas-tarefas";
    case "inbox":
      return "#/entrada";
    case "reports":
      return "#/relatorios";
    case "strategy":
      return "#/metas";
    case "people":
      return "#/pessoas";
    case "settings":
      return `#/ajustes/${settingsSlugs[route.tab]}`;
    case "project":
      return `#/projetos/${route.projectId}/${projectViewSlugs[route.view]}`;
    case "project-settings":
      return `#/projetos/${route.projectId}/configuracoes/${projectSettingsSlugs[route.tab]}`;
  }
}

export function hashToRoute(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [head, id, sub, extra] = parts;
  if (!head) return null;
  if (head === "inicio") return { name: "home" };
  if (head === "minhas-tarefas") return { name: "my-tasks" };
  if (head === "entrada") return { name: "inbox" };
  if (head === "relatorios") return { name: "reports" };
  if (head === "metas") return { name: "strategy" };
  if (head === "pessoas") return { name: "people" };
  if (head === "ajustes") {
    const tab = settingsTabs.find((item) => settingsSlugs[item] === id) ?? "profile";
    return { name: "settings", tab };
  }
  if (head === "projetos" && id) {
    if (sub === "configuracoes") {
      const tab = (Object.keys(projectSettingsSlugs) as ProjectSettingsTab[]).find(
        (item) => projectSettingsSlugs[item] === extra,
      );
      return { name: "project-settings", projectId: id, tab: tab ?? "general" };
    }
    return { name: "project", projectId: id, view: projectViews[sub ?? ""] ?? "board" };
  }
  return null;
}

export type Theme = "system" | "light" | "dark";
export type Accent = "violet" | "blue" | "pink" | "orange" | "green" | "graphite";
export interface Preferences {
  theme: Theme;
  accent: Accent;
  sidebarCollapsed: boolean;
}
const PREFS_KEY = "orbitask:preferences";
function readPrefs(): Preferences {
  const fallback: Preferences = { theme: "system", accent: "violet", sidebarCollapsed: false };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return fallback;
  }
}

export interface Toast {
  id: number;
  message: string;
  tone?: "default" | "success" | "error";
  action?: { label: string; run: () => void };
}

export interface CreateTaskDraft {
  statusId?: string;
  dueDate?: string;
  parentId?: string;
}

function normalize(raw: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...raw,
    members: raw.members ?? [],
    invites: raw.invites ?? [],
    comments: raw.comments ?? [],
    attachments: raw.attachments ?? [],
    activities: raw.activities ?? [],
    checklistItems: raw.checklistItems ?? [],
    dependencies: raw.dependencies ?? [],
    customFields: raw.customFields ?? [],
    customFieldValues: raw.customFieldValues ?? [],
    statuses: [...(raw.statuses ?? [])].sort((a, b) => a.position - b.position),
    tasks: raw.tasks.map((task) => ({
      ...task,
      tagIds: task.tagIds ?? [],
      badgeIds: task.badgeIds ?? [],
      assigneeIds: task.assigneeIds ?? [],
      primaryAssigneeId: task.primaryAssigneeId ?? null,
      followerIds: task.followerIds ?? [],
    })),
  };
}

let toastSeed = 0;

interface State {
  platform: Platform;
  os: string;
  ready: boolean;
  session: AuthSession | null;
  snapshot: WorkspaceSnapshot | null;
  loadingProject: boolean;
  route: Route;
  selectedTaskId: string | null;
  toasts: Toast[];
  prefs: Preferences;
  unread: number;
  revision: number;
  paletteOpen: boolean;
  createTask: CreateTaskDraft | null;
  createProjectOpen: boolean;
  navOpen: boolean;

  configure(platform: Platform, os: string): void;
  boot(initial: Route | null): Promise<void>;
  authenticate(mode: "login" | "signup", input: SignInInput | SignUpInput): Promise<void>;
  acceptInvite(token: string, input: { name: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  navigate(route: Route): void;
  loadProject(projectId: string): Promise<WorkspaceSnapshot | null>;
  refresh(options?: { silent?: boolean }): Promise<void>;
  bump(): void;
  openTask(taskId: string, projectId?: string): Promise<void>;
  closeTask(): void;
  toast(message: string, options?: Omit<Toast, "id" | "message">): void;
  dismissToast(id: number): void;
  fail(error: unknown, fallback?: string): void;
  setPrefs(change: Partial<Preferences>): void;
  setSession(session: AuthSession): void;
  patchSnapshot(change: (snapshot: WorkspaceSnapshot) => WorkspaceSnapshot): void;
  loadUnread(): Promise<void>;
  setUnread(count: number): void;

  addTask(input: { title: string; statusId: string; parentId?: string; extra?: Omit<UpdateTaskInput, "id"> }): Promise<Task | null>;
  updateTask(input: UpdateTaskInput, options?: { announce?: string }): Promise<boolean>;
  moveTask(id: string, statusId: string, position: number): Promise<void>;
  trashTask(id: string): Promise<void>;
  addProject(input: { name: string; color: string; icon: string; description: string }): Promise<Project | null>;
  updateProject(input: UpdateProjectInput): Promise<void>;
  removeProject(id: string): Promise<void>;
  setDensity(density: "compact" | "detailed"): Promise<void>;
  setDefaultView(view: "board" | "list"): Promise<void>;
  setPaletteOpen(open: boolean): void;
  openCreateTask(draft?: CreateTaskDraft): void;
  closeCreateTask(): void;
  setCreateProjectOpen(open: boolean): void;
  setNavOpen(open: boolean): void;
}

export const useStore = create<State>((set, get) => ({
  platform: "web",
  os: "",
  ready: false,
  session: null,
  snapshot: null,
  loadingProject: false,
  route: { name: "home" },
  selectedTaskId: null,
  toasts: [],
  prefs: readPrefs(),
  unread: 0,
  revision: 0,
  paletteOpen: false,
  createTask: null,
  createProjectOpen: false,
  navOpen: false,

  configure: (platform, os) => set({ platform, os }),

  boot: async (initial) => {
    try {
      const session = await api().getSession();
      if (!session) return set({ ready: true, session: null });
      const projectId =
        initial && (initial.name === "project" || initial.name === "project-settings") ? initial.projectId : undefined;
      let snapshot: WorkspaceSnapshot;
      try {
        snapshot = normalize(await api().getSnapshot(projectId));
      } catch {
        snapshot = normalize(await api().getSnapshot());
      }
      set({ session, snapshot, ready: true, route: initial ?? { name: "home" } });
      void get().loadUnread();
    } catch (error) {
      set({ ready: true, session: null });
      get().fail(error, "Não foi possível conectar ao Orbitask");
    }
  },

  authenticate: async (mode, input) => {
    const session = mode === "login" ? await api().signIn(input as SignInInput) : await api().signUp(input as SignUpInput);
    const snapshot = normalize(await api().getSnapshot());
    set({ session, snapshot, route: { name: "home" }, selectedTaskId: null });
    get().toast(mode === "login" ? `Bem-vindo de volta, ${session.user.name.split(" ")[0]}` : "Seu workspace está pronto");
    void get().loadUnread();
  },

  acceptInvite: async (token, input) => {
    const accept = api().acceptInvite;
    if (!accept) throw new Error("Convites só podem ser aceitos pelo navegador");
    const session = await accept(token, input);
    const snapshot = normalize(await api().getSnapshot());
    set({ session, snapshot, route: { name: "home" } });
    get().toast(`Você entrou em ${session.workspace.name}`, { tone: "success" });
  },

  signOut: async () => {
    try {
      await api().signOut();
    } finally {
      set({ session: null, snapshot: null, selectedTaskId: null, route: { name: "home" }, unread: 0 });
    }
  },

  navigate: (route) => {
    set({ route, navOpen: false });
    if ((route.name === "project" || route.name === "project-settings") && get().snapshot?.project.id !== route.projectId)
      void get().loadProject(route.projectId);
  },

  loadProject: async (projectId) => {
    set({ loadingProject: true });
    try {
      const snapshot = normalize(await api().getSnapshot(projectId));
      set({ snapshot });
      return snapshot;
    } catch (error) {
      get().fail(error, "Não foi possível abrir o projeto");
      return null;
    } finally {
      set({ loadingProject: false });
    }
  },

  refresh: async (options) => {
    const current = get().snapshot;
    if (!current) return;
    try {
      const snapshot = normalize(await api().getSnapshot(current.project.id));
      /* Se o usuário trocou de projeto enquanto a resposta chegava, descarta a resposta antiga. */
      if (get().snapshot?.project.id !== current.project.id) return;
      set((state) => ({ snapshot, revision: state.revision + 1 }));
    } catch (error) {
      if (!options?.silent) get().fail(error, "Não foi possível atualizar os dados");
    }
  },

  bump: () => set((state) => ({ revision: state.revision + 1 })),

  openTask: async (taskId, projectId) => {
    if (projectId && get().snapshot?.project.id !== projectId) {
      const snapshot = await get().loadProject(projectId);
      if (!snapshot) return;
    }
    if (!get().snapshot?.tasks.some((task) => task.id === taskId)) {
      get().toast("Esta tarefa não está mais disponível", { tone: "error" });
      return;
    }
    set({ selectedTaskId: taskId });
  },
  closeTask: () => set({ selectedTaskId: null }),

  toast: (message, options) => {
    const id = ++toastSeed;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, ...options }] }));
    setTimeout(() => get().dismissToast(id), options?.action ? 6000 : 3200);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  fail: (error, fallback) => get().toast(errorMessage(error, fallback), { tone: "error" }),

  setPrefs: (change) => {
    const prefs = { ...get().prefs, ...change };
    set({ prefs });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* preferências valem apenas para esta sessão */
    }
  },

  setSession: (session) => set({ session }),
  patchSnapshot: (change) => {
    const snapshot = get().snapshot;
    if (snapshot) set({ snapshot: change(snapshot) });
  },

  loadUnread: async () => {
    try {
      const items = await api().listNotifications();
      set({ unread: items.filter((item) => !item.readAt).length });
    } catch {
      /* contador é auxiliar; falhas não interrompem o uso */
    }
  },
  setUnread: (unread) => set({ unread }),

  addTask: async ({ title, statusId, parentId, extra }) => {
    const snapshot = get().snapshot;
    if (!snapshot || !title.trim()) return null;
    try {
      const task = await api().createTask({ projectId: snapshot.project.id, statusId, title: title.trim(), parentId });
      if (extra && Object.keys(extra).length) await api().updateTask({ id: task.id, ...extra });
      await get().refresh();
      return get().snapshot?.tasks.find((item) => item.id === task.id) ?? task;
    } catch (error) {
      get().fail(error, "Não foi possível criar a tarefa");
      return null;
    }
  },

  updateTask: async (input, options) => {
    const previous = get().snapshot;
    get().patchSnapshot((snapshot) => ({
      ...snapshot,
      tasks: snapshot.tasks.map((task) =>
        task.id === input.id ? { ...task, ...(Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<Task>) } : task,
      ),
    }));
    try {
      await api().updateTask(input);
      await get().refresh();
      if (options?.announce) get().toast(options.announce);
      return true;
    } catch (error) {
      if (previous) set({ snapshot: previous });
      get().fail(error, "Não foi possível salvar a tarefa");
      return false;
    }
  },

  moveTask: async (id, statusId, position) => {
    const previous = get().snapshot;
    get().patchSnapshot((snapshot) => ({
      ...snapshot,
      tasks: snapshot.tasks.map((task) => (task.id === id ? { ...task, statusId, position } : task)),
    }));
    try {
      await api().moveTask({ id, statusId, position });
      await get().refresh();
    } catch (error) {
      if (previous) set({ snapshot: previous });
      get().fail(error, "Não foi possível mover a tarefa");
    }
  },

  trashTask: async (id) => {
    const task = get().snapshot?.tasks.find((item) => item.id === id);
    try {
      await api().trashTask(id);
      set({ selectedTaskId: get().selectedTaskId === id ? null : get().selectedTaskId });
      await get().refresh();
      get().toast(task ? `“${task.title}” foi para a lixeira` : "Tarefa movida para a lixeira", {
        action: {
          label: "Desfazer",
          run: async () => {
            try {
              await api().restoreTask(id);
              await get().refresh();
              get().toast("Tarefa restaurada", { tone: "success" });
            } catch (error) {
              get().fail(error);
            }
          },
        },
      });
    } catch (error) {
      get().fail(error, "Não foi possível excluir a tarefa");
    }
  },

  addProject: async ({ name, color, icon, description }) => {
    try {
      const project = await api().createProject({ name, color });
      if (icon !== "folder" || description.trim()) await api().updateProject({ id: project.id, icon, description });
      const snapshot = normalize(await api().getSnapshot(project.id));
      set({ snapshot, route: { name: "project", projectId: project.id, view: "board" }, createProjectOpen: false });
      get().toast("Projeto criado", { tone: "success" });
      return project;
    } catch (error) {
      get().fail(error, "Não foi possível criar o projeto");
      return null;
    }
  },

  updateProject: async (input) => {
    try {
      const project = await api().updateProject(input);
      get().patchSnapshot((snapshot) => ({
        ...snapshot,
        project: snapshot.project.id === project.id ? project : snapshot.project,
        projects: snapshot.projects.map((item) => (item.id === project.id ? project : item)),
      }));
      get().toast("Projeto atualizado");
    } catch (error) {
      get().fail(error, "Não foi possível atualizar o projeto");
      throw error;
    }
  },

  removeProject: async (id) => {
    await api().removeProject(id);
    const snapshot = normalize(await api().getSnapshot());
    set({ snapshot, route: { name: "home" }, selectedTaskId: null });
    get().toast("Projeto excluído");
  },

  setDensity: async (density) => {
    const snapshot = get().snapshot;
    if (!snapshot) return;
    get().patchSnapshot((current) => ({ ...current, preferences: { ...current.preferences, cardDensity: density } }));
    try {
      await api().updateProjectPreferences({ projectId: snapshot.project.id, cardDensity: density });
    } catch (error) {
      get().fail(error);
    }
  },
  setDefaultView: async (view) => {
    const snapshot = get().snapshot;
    if (!snapshot || snapshot.preferences.defaultView === view) return;
    get().patchSnapshot((current) => ({ ...current, preferences: { ...current.preferences, defaultView: view } }));
    try {
      await api().updateProjectPreferences({ projectId: snapshot.project.id, defaultView: view });
    } catch {
      /* preferência de visualização é secundária */
    }
  },

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  openCreateTask: (draft = {}) => set({ createTask: draft }),
  closeCreateTask: () => set({ createTask: null }),
  setCreateProjectOpen: (createProjectOpen) => set({ createProjectOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
}));

export const isAdmin = () => useStore.getState().snapshot?.workspace.role === "admin";
