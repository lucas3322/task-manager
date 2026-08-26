import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('#665cf6'),
  createdAt: text('created_at').notNull(),
})

export const statuses = sqliteTable('statuses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  position: integer('position').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  parentId: text('parent_id'),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  statusId: text('status_id').notNull().references(() => statuses.id),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull().default('medium'),
  dueDate: text('due_date'),
  position: integer('position').notNull().default(0),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const activityLog = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull(),
})
