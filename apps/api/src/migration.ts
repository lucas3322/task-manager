export const migration = `
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color VARCHAR(16) NOT NULL DEFAULT '#665cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS statuses (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16) NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status_id VARCHAR(40) NOT NULL REFERENCES statuses(id),
  priority VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date DATE,
  position BIGINT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status_id, position) WHERE deleted_at IS NULL;
`
