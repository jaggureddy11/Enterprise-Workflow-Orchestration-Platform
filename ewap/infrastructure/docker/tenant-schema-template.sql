-- This template is applied to each new tenant schema
-- Replace {schema_name} with actual tenant schema during execution

CREATE SCHEMA IF NOT EXISTS {schema_name};
SET search_path = {schema_name};

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  department      VARCHAR(100),
  manager_id      UUID REFERENCES users(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- TABLE: permissions
-- ============================================================
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) UNIQUE NOT NULL,
  resource    VARCHAR(50) NOT NULL,
  action      VARCHAR(50) NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role        VARCHAR(50) NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  is_revoked  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
-- TABLE: workflows
-- ============================================================
CREATE TABLE workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  version         INTEGER NOT NULL DEFAULT 1,
  trigger_type    VARCHAR(50) NOT NULL,
  trigger_config  JSONB NOT NULL DEFAULT '{}',
  definition      JSONB NOT NULL DEFAULT '{"steps": [], "transitions": []}',
  created_by      UUID NOT NULL REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);

-- ============================================================
-- TABLE: workflow_instances
-- ============================================================
CREATE TABLE workflow_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id),
  workflow_version  INTEGER NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  current_step_id   UUID,
  context           JSONB NOT NULL DEFAULT '{}',
  triggered_by      UUID REFERENCES users(id),
  trigger_data      JSONB NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,
  version           INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instances_workflow ON workflow_instances(workflow_id, status);
CREATE INDEX idx_instances_status ON workflow_instances(status, created_at DESC);

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES workflow_instances(id),
  step_id         UUID,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  assignee_id     UUID REFERENCES users(id),
  assignee_role   VARCHAR(100),
  due_at          TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES users(id),
  form_data       JSONB NOT NULL DEFAULT '{}',
  comments        JSONB NOT NULL DEFAULT '[]',
  version         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX idx_tasks_instance ON tasks(instance_id);
CREATE INDEX idx_tasks_due_at ON tasks(due_at) WHERE status = 'OPEN';

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  event_type      VARCHAR(100) NOT NULL,
  actor_id        UUID REFERENCES users(id),
  actor_email     VARCHAR(255),
  resource_type   VARCHAR(100),
  resource_id     UUID,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB NOT NULL DEFAULT '{}',
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- Seed default permissions
-- ============================================================
INSERT INTO permissions (name, resource, action, description) VALUES
  ('workflow:create', 'workflow', 'create', 'Create new workflows'),
  ('workflow:read', 'workflow', 'read', 'View workflows'),
  ('workflow:publish', 'workflow', 'publish', 'Publish workflows'),
  ('workflow:delete', 'workflow', 'delete', 'Delete workflows'),
  ('instance:trigger', 'instance', 'trigger', 'Trigger workflow instances'),
  ('instance:cancel', 'instance', 'cancel', 'Cancel running instances'),
  ('task:complete', 'task', 'complete', 'Complete assigned tasks'),
  ('audit:read', 'audit', 'read', 'View audit logs'),
  ('analytics:read', 'analytics', 'read', 'View analytics'),
  ('user:manage', 'user', 'manage', 'Manage users')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'OWNER', id FROM permissions WHERE TRUE
UNION ALL
SELECT 'ADMIN', id FROM permissions WHERE TRUE
UNION ALL
SELECT 'MANAGER', id FROM permissions WHERE resource != 'audit' AND resource != 'user'
UNION ALL
SELECT 'MEMBER', id FROM permissions WHERE resource IN ('workflow', 'instance', 'task')
UNION ALL
SELECT 'VIEWER', id FROM permissions WHERE action = 'read'
ON CONFLICT DO NOTHING;

-- Reset search_path
RESET search_path;
