import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { CreateTaskInput, Task, UpdateTaskInput, WorkspaceSnapshot } from '@orbitask/contracts'
import { app } from 'electron'
import { activityLog, projects, statuses, tasks } from './schema'

let sqlite: Database.Database
let db: ReturnType<typeof drizzle>

export function initializeDatabase(): void {
  sqlite = new Database(join(app.getPath('userData'), 'orbitask.sqlite'))
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#665cf6', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS statuses (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), parent_id TEXT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status_id TEXT NOT NULL REFERENCES statuses(id), priority TEXT NOT NULL DEFAULT 'medium', due_date TEXT, position INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status_id, position);
  `)
  db = drizzle(sqlite)
  seedDatabase()
}

function seedDatabase(): void {
  const existing = db.select().from(projects).get()
  if (existing) return
  const now = new Date().toISOString()
  const projectId = randomUUID()
  const statusRows = [
    { id: 'backlog', name: 'A fazer', color: '#a0a5b1', position: 0 },
    { id: 'progress', name: 'Em andamento', color: '#665cf6', position: 1 },
    { id: 'review', name: 'Em revisão', color: '#ee9b3b', position: 2 },
    { id: 'done', name: 'Concluído', color: '#2ca87f', position: 3 },
  ]
  db.insert(projects).values({ id: projectId, name: 'Lançamento do produto', description: 'Planejamento da primeira versão do Orbitask', color: '#665cf6', createdAt: now }).run()
  db.insert(statuses).values(statusRows).run()
  db.insert(tasks).values([
    { id: randomUUID(), projectId, parentId: null, title: 'Definir objetivos do trimestre', description: '', statusId: 'backlog', priority: 'high', dueDate: null, position: 0, deletedAt: null, createdAt: now, updatedAt: now },
    { id: randomUUID(), projectId, parentId: null, title: 'Validar protótipo com usuários', description: '', statusId: 'progress', priority: 'urgent', dueDate: null, position: 0, deletedAt: null, createdAt: now, updatedAt: now },
    { id: randomUUID(), projectId, parentId: null, title: 'Preparar identidade visual', description: '', statusId: 'review', priority: 'medium', dueDate: null, position: 0, deletedAt: null, createdAt: now, updatedAt: now },
  ]).run()
}

function log(entityId: string, action: string, payload: unknown): void {
  db.insert(activityLog).values({ id: randomUUID(), entityType: 'task', entityId, action, payload: JSON.stringify(payload), createdAt: new Date().toISOString() }).run()
}

export function getSnapshot(): WorkspaceSnapshot {
  const project = db.select().from(projects).get()
  if (!project) throw new Error('Workspace não inicializado')
  return {
    project,
    statuses: db.select().from(statuses).orderBy(asc(statuses.position)).all(),
    tasks: db.select().from(tasks).where(and(eq(tasks.projectId, project.id), isNull(tasks.deletedAt))).orderBy(asc(tasks.position)).all() as Task[],
  }
}

export function createTask(input: CreateTaskInput): Task {
  if (!input.title.trim()) throw new Error('O título da tarefa é obrigatório')
  const now = new Date().toISOString()
  const task: Task = { id: randomUUID(), projectId: input.projectId, parentId: input.parentId ?? null, title: input.title.trim(), description: '', statusId: input.statusId, priority: input.priority ?? 'medium', dueDate: null, position: Date.now(), deletedAt: null, createdAt: now, updatedAt: now }
  db.transaction(() => { db.insert(tasks).values(task).run(); log(task.id, 'created', task) })
  return task
}

export function updateTask(input: UpdateTaskInput): Task {
  const current = db.select().from(tasks).where(eq(tasks.id, input.id)).get() as Task | undefined
  if (!current) throw new Error('Tarefa não encontrada')
  const changes = { ...input, updatedAt: new Date().toISOString() }
  delete (changes as Partial<UpdateTaskInput>).id
  db.transaction(() => { db.update(tasks).set(changes).where(eq(tasks.id, input.id)).run(); log(input.id, 'updated', changes) })
  return db.select().from(tasks).where(eq(tasks.id, input.id)).get() as Task
}

export function trashTask(id: string): void {
  const deletedAt = new Date().toISOString()
  db.transaction(() => { db.update(tasks).set({ deletedAt, updatedAt: deletedAt }).where(eq(tasks.id, id)).run(); log(id, 'trashed', { deletedAt }) })
}
