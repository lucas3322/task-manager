export const migration = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin','member','guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin','member','guest')),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invites_pending ON workspace_invites(workspace_id,email) WHERE accepted_at IS NULL;
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color VARCHAR(16) NOT NULL DEFAULT '#665cf6',
  icon VARCHAR(40) NOT NULL DEFAULT 'folder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id,user_id)
);
CREATE TABLE IF NOT EXISTS invite_projects (
  invite_id UUID NOT NULL REFERENCES workspace_invites(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (invite_id,project_id)
);
CREATE TABLE IF NOT EXISTS statuses (
  id VARCHAR(40) PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16) NOT NULL,
  position INTEGER NOT NULL
);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon VARCHAR(40) NOT NULL DEFAULT 'folder';
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status_id VARCHAR(40) NOT NULL REFERENCES statuses(id),
  priority VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  start_date DATE,
  due_date DATE,
  position BIGINT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
CREATE TABLE IF NOT EXISTS project_priorities (
  id VARCHAR(40) NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16) NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id,id)
);
CREATE TABLE IF NOT EXISTS project_tags (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16) NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_badges (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16) NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES project_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id,tag_id)
);
CREATE TABLE IF NOT EXISTS task_badges (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES project_badges(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id,badge_id)
);
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_primary_assignee ON task_assignees(task_id) WHERE is_primary;
CREATE TABLE IF NOT EXISTS task_followers (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id,user_id)
);
CREATE TABLE IF NOT EXISTS project_custom_fields (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('text','number','date','single','multi')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS task_custom_field_values (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES project_custom_fields(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id,field_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_fields_project ON project_custom_fields(project_id,position);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(240) NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION notify_task_activity() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_type='task' AND NEW.action IN ('updated','commented','attachment_added') THEN
    INSERT INTO notifications (id,user_id,task_id,project_id,type,title,message)
    SELECT gen_random_uuid(),people.user_id,t.id,t.project_id,NEW.action,t.title,
      CASE NEW.action WHEN 'commented' THEN 'Novo comentário na tarefa' WHEN 'attachment_added' THEN 'Novo anexo na tarefa' ELSE 'A tarefa foi atualizada' END
    FROM tasks t
    JOIN (SELECT user_id FROM task_assignees WHERE task_id=NEW.entity_id UNION SELECT user_id FROM task_followers WHERE task_id=NEW.entity_id) people ON TRUE
    WHERE t.id=NEW.entity_id AND people.user_id IS DISTINCT FROM NEW.user_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_notify_task_activity ON activity_log;
CREATE TRIGGER trg_notify_task_activity AFTER INSERT ON activity_log FOR EACH ROW EXECUTE FUNCTION notify_task_activity();
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name VARCHAR(240) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(task_id,depends_on_task_id),
  CHECK(task_id<>depends_on_task_id)
);
CREATE TABLE IF NOT EXISTS user_project_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  card_density VARCHAR(16) NOT NULL DEFAULT 'detailed' CHECK (card_density IN ('compact','detailed')),
  default_view VARCHAR(16) NOT NULL DEFAULT 'board' CHECK (default_view IN ('board','list')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id,project_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status_id, position) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_priorities_project ON project_priorities(project_id,position);
CREATE INDEX IF NOT EXISTS idx_tags_project ON project_tags(project_id,position);
CREATE INDEX IF NOT EXISTS idx_badges_project ON project_badges(project_id,position);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id,created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id,created_at);
CREATE INDEX IF NOT EXISTS idx_checklist_task ON task_checklist_items(task_id,position);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON task_dependencies(depends_on_task_id,task_id);
CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_log(entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id,project_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id,task_id);
CREATE INDEX IF NOT EXISTS idx_task_followers_user ON task_followers(user_id,task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,read_at,created_at DESC);
CREATE TABLE IF NOT EXISTS project_automations (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('task_created','status_changed')),
  trigger_value TEXT,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES project_automations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automations_project ON project_automations(project_id,created_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs ON automation_runs(automation_id,created_at DESC);
CREATE TABLE IF NOT EXISTS user_saved_filters (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  filter JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,project_id,name)
);
CREATE TABLE IF NOT EXISTS user_recent_searches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  query VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,workspace_id,query)
);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_project ON user_saved_filters(user_id,project_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON user_recent_searches(user_id,workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color VARCHAR(16) NOT NULL DEFAULT '#665cf6',
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  health VARCHAR(20) NOT NULL DEFAULT 'on_track' CHECK (health IN ('on_track','at_risk','off_track','on_hold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS portfolio_projects (
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY(portfolio_id,project_id)
);
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','on_track','at_risk','completed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS goal_projects (
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY(goal_id,project_id)
);
CREATE INDEX IF NOT EXISTS idx_portfolios_workspace ON portfolios(workspace_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id,updated_at DESC);
`
