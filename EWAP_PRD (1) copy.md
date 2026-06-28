# Enterprise Workflow Automation Platform (EWAP)
## Product Requirements Document v1.0
### For Agentic IDE Development

---

## TABLE OF CONTENTS

1. [Product Vision](#1-product-vision)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Monorepo Folder Structure](#4-monorepo-folder-structure)
5. [Database Design](#5-database-design)
6. [Kafka Topics & Event Contracts](#6-kafka-topics--event-contracts)
7. [Redis Key Patterns](#7-redis-key-patterns)
8. [Service Specifications](#8-service-specifications)
9. [Engineering Patterns Implementation](#9-engineering-patterns-implementation)
10. [API Contracts](#10-api-contracts)
11. [Test Strategy](#11-test-strategy)
12. [Observability Stack](#12-observability-stack)
13. [Docker & Kubernetes](#13-docker--kubernetes)
14. [Environment Variables](#14-environment-variables)
15. [Implementation Phases](#15-implementation-phases)
16. [Agentic IDE Rules](#16-agentic-ide-rules)

---

## 1. PRODUCT VISION

### 1.1 What We Are Building

A **multi-tenant Enterprise Workflow Automation Platform** — a production-grade system
combining the workflow automation of Salesforce Flow, the task management of Jira,
and the IT process automation of ServiceNow.

Organizations register as **tenants**. Their employees use the platform to design, execute,
and monitor business processes — from employee onboarding and expense approvals to
IT provisioning and compliance reviews.

### 1.2 Core Value Proposition

- Any business process that involves multiple people, sequential approvals, and conditional
  branching can be modeled as a workflow and automated
- Built-in observability, audit logs, and RBAC make it enterprise-compliant from day one
- AI-powered natural language workflow creation lowers the barrier to automation

### 1.3 Primary User Flows

**Flow 1 — Workflow Creation:**
Admin logs in → opens Workflow Builder → defines steps (approval, task, notification,
condition) → sets triggers → publishes workflow → workflow becomes active

**Flow 2 — Workflow Execution:**
Trigger fires (manual, scheduled, webhook) → Workflow Service creates a WorkflowInstance →
State machine advances through steps → each step dispatches to Task/Notification/AI
Service → final step marks instance COMPLETED → Analytics + Audit updated

**Flow 3 — AI-Powered Creation:**
User types "Create an employee onboarding workflow with manager and HR approval then
IT laptop allocation" → AI Service generates workflow definition JSON → calls Workflow
Service API → workflow created and ready to run

### 1.4 Canonical Example Workflow (Employee Onboarding)

```
[START]
   ↓
[Step 1] TRIGGER: New employee record created in HR system
   ↓
[Step 2] TASK: Manager reviews and approves onboarding plan
         - Assignee: employee.manager
         - SLA: 48 hours
         - On reject → END (rejected)
   ↓
[Step 3] TASK: HR team approves benefits enrollment
         - Assignee: role:HR_TEAM
         - SLA: 24 hours
   ↓
[Step 4] TASK: IT team allocates laptop and credentials
         - Assignee: role:IT_TEAM
         - SLA: 72 hours
   ↓
[Step 5] NOTIFICATION: Send welcome email to new employee
         - Channel: EMAIL
         - Template: WELCOME_EMPLOYEE
   ↓
[Step 6] NOTIFICATION: Post to #general Slack channel
         - Channel: SLACK
         - Webhook: tenant.slack_webhook
   ↓
[COMPLETED]
```

---

## 2. TECH STACK

### 2.1 Languages & Runtime

| Layer | Technology | Version |
|-------|-----------|---------|
| All Services | Node.js | 20.x LTS |
| Language | TypeScript | 5.4.x |
| Package Manager | pnpm (workspaces) | 9.x |

### 2.2 Frameworks & Libraries

| Purpose | Library | Version |
|---------|---------|---------|
| HTTP Server | Express | 4.19.x |
| Validation | Zod | 3.23.x |
| ORM | Prisma | 5.14.x |
| Kafka Client | kafkajs | 2.2.x |
| Redis Client | ioredis | 5.3.x |
| OpenTelemetry | @opentelemetry/sdk-node | 0.52.x |
| JWT | jsonwebtoken | 9.0.x |
| Password Hashing | bcryptjs | 2.4.x |
| AI/LLM | @langchain/openai + langchain | 0.2.x |
| Email | nodemailer | 6.9.x |
| Test Runner | Jest + ts-jest | 29.x |
| E2E Testing | Playwright | 1.44.x |
| HTTP Mock | nock | 13.5.x |
| Supertest | supertest | 7.0.x |
| Logging | pino | 9.x |
| Rate Limiting | express-rate-limit + rate-limit-redis | 7.x |
| API Docs | swagger-jsdoc + swagger-ui-express | 6.x |

### 2.3 Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Primary DB | PostgreSQL 16 | Multi-tenant data, workflow state |
| Cache + Locks | Redis 7 | Caching, distributed locks, pub/sub |
| Message Bus | Apache Kafka 3.7 | Async event streaming between services |
| Search | Elasticsearch 8 | Full-text workflow and task search |
| Tracing | OpenTelemetry + Jaeger | Distributed request tracing |
| Metrics | Prometheus + Grafana | SLO dashboards, alerting |
| Container | Docker + Docker Compose | Local development |
| Orchestration | Kubernetes + Helm | Production deployment |
| CI/CD | GitHub Actions | Test, build, deploy pipeline |

### 2.4 Frontend (Admin Dashboard)

| Technology | Purpose |
|-----------|---------|
| React 18 + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| React Flow (reactflow) | Visual workflow builder canvas |
| React Query (tanstack) | Server state management |
| Zustand | Client state management |
| Recharts | Analytics charts |

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│     React Dashboard (Port 3000)    External Webhooks            │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────▼───────────────────────────────────┐
│                    API GATEWAY (Port 4000)                       │
│    Rate Limiting │ JWT Validation │ Tenant Routing │ Logging     │
└──┬──────────┬──────────┬──────────┬──────────┬────────────┬─────┘
   │          │          │          │          │            │
   ▼          ▼          ▼          ▼          ▼            ▼
[AUTH]   [WORKFLOW]  [TASK]   [NOTIF]   [ANALYTICS]  [AI SERVICE]
:4001     :4002      :4003    :4004      :4005         :4006
   │          │          │          │          │            │
   └──────────┴──────────┴──────────┴──────────┴────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           [KAFKA]         [REDIS]         [AUDIT :4007]
              │               │
    ┌─────────┼──────┐        │
    ▼         ▼      ▼        ▼
[POSTGRES] [ELASTIC] [JAEGER] [PROMETHEUS]
                                    │
                               [GRAFANA]
```

### 3.2 Multi-Tenancy Strategy

**Schema-per-Tenant isolation in PostgreSQL.**

- Each tenant gets its own PostgreSQL schema (e.g., `tenant_acme`, `tenant_globex`)
- The public schema holds only: `tenants`, `system_configs`, `audit_log_global`
- All tenant-specific tables (workflows, tasks, users, etc.) live inside the tenant schema
- Prisma uses dynamic schema switching via `SET search_path = tenant_xxx`
- Tenant schema name is derived from `tenant.slug` (alphanumeric, underscored)

Benefits: Complete data isolation, no risk of cross-tenant data leaks, easy compliance,
per-tenant backup/restore, schema-level access control.

### 3.3 Service Communication

**Synchronous (HTTP):** API Gateway → downstream services for request/response flows
(user-facing APIs, CRUD operations)

**Asynchronous (Kafka):** Inter-service events (workflow step completed → trigger next step,
task created → send notification, workflow completed → update analytics)

**Rule:** A service NEVER calls another service's HTTP API directly. All inter-service
communication goes through Kafka topics. The API Gateway is the only entry point for
synchronous external requests.

### 3.4 Request Lifecycle (Workflow Step Execution)

```
1. POST /api/workflows/:id/trigger → API Gateway
2. Gateway validates JWT, extracts tenant_id, routes to Workflow Service
3. Workflow Service creates WorkflowInstance in DB (status: RUNNING)
4. Workflow Service emits kafka event: workflow.instance.started
5. Workflow Service starts state machine at Step 1
6. Step 1 is a TASK type → Workflow Service emits: task.create.requested
7. Task Service consumes event → creates Task in DB → emits: task.created
8. Task Service emits: notification.send.requested (assignee notified)
9. Notification Service consumes → sends email/Slack → emits: notification.sent
10. Assignee completes task via API → Task Service emits: task.completed
11. Workflow Service consumes task.completed → advances state machine to Step 2
12. ... (repeats per step)
13. Final step completes → Workflow Service emits: workflow.instance.completed
14. Analytics Service consumes → updates metrics
15. Audit Service consumes all events → writes immutable audit trail
```

---

## 4. MONOREPO FOLDER STRUCTURE

```
ewap/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Test + lint on every PR
│       ├── build.yml                 # Docker build + push on merge
│       └── deploy.yml                # Helm deploy to k8s on release
│
├── packages/
│   ├── shared/                       # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── workflow.types.ts
│   │   │   │   ├── task.types.ts
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── tenant.types.ts
│   │   │   │   └── events.types.ts   # All Kafka event interfaces
│   │   │   ├── constants/
│   │   │   │   ├── kafka.topics.ts
│   │   │   │   ├── redis.keys.ts
│   │   │   │   └── error.codes.ts
│   │   │   ├── utils/
│   │   │   │   ├── tenant.util.ts    # Schema name generation
│   │   │   │   ├── pagination.util.ts
│   │   │   │   └── retry.util.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── kafka-client/                 # Shared Kafka producer/consumer factory
│   │   ├── src/
│   │   │   ├── producer.ts
│   │   │   ├── consumer.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── telemetry/                    # Shared OpenTelemetry setup
│       ├── src/
│       │   ├── tracer.ts
│       │   ├── metrics.ts
│       │   └── index.ts
│       └── package.json
│
├── services/
│   ├── api-gateway/
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── rate-limit.middleware.ts
│   │   │   │   ├── tenant.middleware.ts
│   │   │   │   └── logger.middleware.ts
│   │   │   ├── proxy/
│   │   │   │   └── service.proxy.ts
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   └── user.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── rbac.service.ts
│   │   │   ├── middleware/
│   │   │   │   └── permission.middleware.ts
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── user.routes.ts
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── workflow-service/
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   │   ├── state-machine.ts       # Core state machine engine
│   │   │   │   ├── step-executor.ts       # Executes individual steps
│   │   │   │   └── transition-evaluator.ts # Evaluates conditions for transitions
│   │   │   ├── controllers/
│   │   │   │   ├── workflow.controller.ts
│   │   │   │   └── instance.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── workflow.service.ts
│   │   │   │   └── instance.service.ts
│   │   │   ├── consumers/
│   │   │   │   └── task-completed.consumer.ts
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma
│   │   │   ├── routes/
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── task-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── task.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── task.service.ts
│   │   │   │   └── assignment.service.ts
│   │   │   ├── consumers/
│   │   │   │   └── task-create.consumer.ts
│   │   │   ├── locks/
│   │   │   │   └── task.lock.ts           # Redis distributed lock impl
│   │   │   ├── prisma/
│   │   │   ├── routes/
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── notification-service/
│   │   ├── src/
│   │   │   ├── channels/
│   │   │   │   ├── email.channel.ts
│   │   │   │   └── slack.channel.ts
│   │   │   ├── consumers/
│   │   │   │   ├── notification.consumer.ts
│   │   │   │   └── dlq.consumer.ts        # Dead Letter Queue processor
│   │   │   ├── retry/
│   │   │   │   └── retry.handler.ts
│   │   │   ├── templates/
│   │   │   │   ├── welcome-employee.html
│   │   │   │   └── task-assigned.html
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── analytics-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── analytics.controller.ts
│   │   │   ├── consumers/
│   │   │   │   └── workflow-events.consumer.ts
│   │   │   ├── aggregators/
│   │   │   │   ├── completion-rate.aggregator.ts
│   │   │   │   └── bottleneck-detector.ts
│   │   │   ├── prisma/
│   │   │   ├── routes/
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── audit-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   └── audit.controller.ts
│   │   │   ├── consumers/
│   │   │   │   └── audit.consumer.ts      # Consumes ALL kafka topics
│   │   │   ├── services/
│   │   │   │   └── audit.service.ts
│   │   │   ├── prisma/
│   │   │   ├── routes/
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── ai-service/
│       ├── src/
│       │   ├── controllers/
│       │   │   └── ai.controller.ts
│       │   ├── chains/
│       │   │   ├── workflow-generator.chain.ts
│       │   │   └── anomaly-detector.chain.ts
│       │   ├── prompts/
│       │   │   ├── workflow-generation.prompt.ts
│       │   │   └── workflow-schema.json  # JSON schema fed to LLM
│       │   ├── routes/
│       │   ├── app.ts
│       │   └── index.ts
│       ├── __tests__/
│       ├── Dockerfile
│       └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── workflow-builder/
│   │   │   │   ├── WorkflowCanvas.tsx    # React Flow canvas
│   │   │   │   ├── StepNode.tsx          # Custom node component
│   │   │   │   ├── StepPanel.tsx         # Right panel to configure step
│   │   │   │   └── Toolbar.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── MetricsCard.tsx
│   │   │   │   ├── WorkflowTable.tsx
│   │   │   │   └── InstanceTimeline.tsx
│   │   │   └── shared/
│   │   │       ├── Button.tsx
│   │   │       ├── Badge.tsx
│   │   │       └── Table.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── WorkflowBuilder.tsx
│   │   │   ├── WorkflowInstances.tsx
│   │   │   ├── Tasks.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── AuditLog.tsx
│   │   ├── api/
│   │   │   └── client.ts               # Axios instance with JWT interceptor
│   │   ├── store/
│   │   │   └── workflow.store.ts       # Zustand store for builder state
│   │   └── App.tsx
│   ├── vite.config.ts
│   └── package.json
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── docker-compose.dev.yml
│   ├── k8s/
│   │   ├── helm/
│   │   │   └── ewap/
│   │   │       ├── Chart.yaml
│   │   │       ├── values.yaml
│   │   │       └── templates/
│   │   └── manifests/
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/
│           └── ewap-overview.json
│
├── e2e/
│   ├── tests/
│   │   ├── workflow-creation.spec.ts
│   │   ├── workflow-execution.spec.ts
│   │   └── approval-chain.spec.ts
│   └── playwright.config.ts
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── .env.example
```

---

## 5. DATABASE DESIGN

### 5.1 Public Schema (System-Level Tables)

```sql
-- ============================================================
-- TABLE: tenants (public schema)
-- ============================================================
CREATE TABLE public.tenants (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  NOT NULL,
  slug          VARCHAR(100)  UNIQUE NOT NULL,  -- used as schema name
  plan          VARCHAR(50)   NOT NULL DEFAULT 'FREE', -- FREE | STARTER | PRO | ENTERPRISE
  status        VARCHAR(50)   NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | SUSPENDED | DELETED
  settings      JSONB         NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_log_global (public schema - all cross-tenant events)
-- ============================================================
CREATE TABLE public.audit_log_global (
  id            BIGSERIAL     PRIMARY KEY,
  tenant_id     UUID          REFERENCES public.tenants(id),
  event_type    VARCHAR(100)  NOT NULL,
  actor_id      UUID,
  resource_type VARCHAR(100),
  resource_id   UUID,
  payload       JSONB         NOT NULL DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_global_tenant ON public.audit_log_global(tenant_id, created_at DESC);
```

### 5.2 Tenant Schema Tables (replicated per tenant)

All tables below are created inside `tenant_{slug}` schema upon tenant registration.

```sql
-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255)  UNIQUE NOT NULL,
  password_hash   VARCHAR(255)  NOT NULL,
  first_name      VARCHAR(100)  NOT NULL,
  last_name       VARCHAR(100)  NOT NULL,
  role            VARCHAR(50)   NOT NULL DEFAULT 'MEMBER',
  -- OWNER | ADMIN | MANAGER | MEMBER | VIEWER
  department      VARCHAR(100),
  manager_id      UUID          REFERENCES users(id),
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- TABLE: permissions (RBAC)
-- ============================================================
CREATE TABLE permissions (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100)  UNIQUE NOT NULL, -- e.g., 'workflow:create'
  resource    VARCHAR(50)   NOT NULL,
  action      VARCHAR(50)   NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role        VARCHAR(50)   NOT NULL,
  permission_id UUID        REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE refresh_tokens (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255)  UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ   NOT NULL,
  is_revoked  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
-- TABLE: workflows
-- ============================================================
CREATE TABLE workflows (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255)  NOT NULL,
  description     TEXT,
  status          VARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
  -- DRAFT | ACTIVE | PAUSED | ARCHIVED
  version         INTEGER       NOT NULL DEFAULT 1,
  trigger_type    VARCHAR(50)   NOT NULL,
  -- MANUAL | SCHEDULED | WEBHOOK | EVENT
  trigger_config  JSONB         NOT NULL DEFAULT '{}',
  -- For SCHEDULED: { "cron": "0 9 * * 1" }
  -- For WEBHOOK:   { "secret": "xxx", "event_types": ["user.created"] }
  definition      JSONB         NOT NULL DEFAULT '{"steps": [], "transitions": []}',
  -- Full workflow definition with steps and transition rules
  created_by      UUID          NOT NULL REFERENCES users(id),
  updated_by      UUID          REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);

-- Elasticsearch sync trigger (application-level, via Kafka)

-- ============================================================
-- TABLE: workflow_steps (denormalized from definition for querying)
-- ============================================================
CREATE TABLE workflow_steps (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID          NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_order      INTEGER       NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  step_type       VARCHAR(50)   NOT NULL,
  -- TASK | NOTIFICATION | CONDITION | DELAY | WEBHOOK | AI_ACTION
  config          JSONB         NOT NULL DEFAULT '{}',
  -- TASK:         { "assignee_type": "USER|ROLE", "assignee": "uuid|ROLE_NAME",
  --                 "sla_hours": 48, "form_schema": {...} }
  -- NOTIFICATION: { "channel": "EMAIL|SLACK", "template": "xxx", "recipients": [...] }
  -- CONDITION:    { "expression": "$.data.amount > 5000", "true_step": 3, "false_step": 5 }
  -- DELAY:        { "duration_hours": 24 }
  is_terminal     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_steps_workflow ON workflow_steps(workflow_id, step_order);

-- ============================================================
-- TABLE: workflow_instances
-- ============================================================
CREATE TABLE workflow_instances (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID          NOT NULL REFERENCES workflows(id),
  workflow_version  INTEGER       NOT NULL,
  status            VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
  -- PENDING | RUNNING | PAUSED | COMPLETED | FAILED | CANCELLED
  current_step_id   UUID          REFERENCES workflow_steps(id),
  context           JSONB         NOT NULL DEFAULT '{}',
  -- Dynamic data bag passed between steps: user input, computed values, etc.
  triggered_by      UUID          REFERENCES users(id),
  trigger_data      JSONB         NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,
  version           INTEGER       NOT NULL DEFAULT 0, -- OPTIMISTIC LOCKING
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_instances_workflow ON workflow_instances(workflow_id, status);
CREATE INDEX idx_instances_status ON workflow_instances(status, created_at DESC);

-- ============================================================
-- TABLE: instance_step_executions (step-level audit within an instance)
-- ============================================================
CREATE TABLE instance_step_executions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID          NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_id         UUID          NOT NULL REFERENCES workflow_steps(id),
  status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
  -- PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  output          JSONB         NOT NULL DEFAULT '{}',
  error           TEXT,
  attempt_count   INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_executions_instance ON instance_step_executions(instance_id, step_id);

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE tasks (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID          NOT NULL REFERENCES workflow_instances(id),
  step_id         UUID          NOT NULL REFERENCES workflow_steps(id),
  title           VARCHAR(255)  NOT NULL,
  description     TEXT,
  status          VARCHAR(50)   NOT NULL DEFAULT 'OPEN',
  -- OPEN | IN_PROGRESS | COMPLETED | REJECTED | EXPIRED | CANCELLED
  priority        VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM',
  -- LOW | MEDIUM | HIGH | CRITICAL
  assignee_id     UUID          REFERENCES users(id),
  assignee_role   VARCHAR(100), -- populated if assigned to a role
  due_at          TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID          REFERENCES users(id),
  form_data       JSONB         NOT NULL DEFAULT '{}', -- submitted form values
  comments        JSONB         NOT NULL DEFAULT '[]', -- array of comment objects
  version         INTEGER       NOT NULL DEFAULT 0, -- OPTIMISTIC LOCKING
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX idx_tasks_instance ON tasks(instance_id);
CREATE INDEX idx_tasks_due_at ON tasks(due_at) WHERE status = 'OPEN';

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID          REFERENCES workflow_instances(id),
  channel         VARCHAR(50)   NOT NULL, -- EMAIL | SLACK | IN_APP
  recipient       VARCHAR(255)  NOT NULL, -- email address or slack channel
  template_id     VARCHAR(100)  NOT NULL,
  payload         JSONB         NOT NULL DEFAULT '{}',
  status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
  -- PENDING | SENT | FAILED | DEAD_LETTERED
  attempt_count   INTEGER       NOT NULL DEFAULT 0,
  max_attempts    INTEGER       NOT NULL DEFAULT 3,
  next_retry_at   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_status ON notifications(status, next_retry_at);

-- ============================================================
-- TABLE: analytics_snapshots
-- ============================================================
CREATE TABLE analytics_snapshots (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id           UUID          REFERENCES workflows(id),
  snapshot_date         DATE          NOT NULL,
  total_instances       INTEGER       NOT NULL DEFAULT 0,
  completed_instances   INTEGER       NOT NULL DEFAULT 0,
  failed_instances      INTEGER       NOT NULL DEFAULT 0,
  avg_duration_ms       BIGINT,
  p50_duration_ms       BIGINT,
  p95_duration_ms       BIGINT,
  step_metrics          JSONB         NOT NULL DEFAULT '{}',
  -- { "step_uuid": { "avg_duration_ms": 1200, "completion_rate": 0.95 } }
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_id, snapshot_date)
);
CREATE INDEX idx_analytics_workflow_date ON analytics_snapshots(workflow_id, snapshot_date DESC);

-- ============================================================
-- TABLE: audit_logs (tenant-level, immutable)
-- ============================================================
CREATE TABLE audit_logs (
  id              BIGSERIAL     PRIMARY KEY,
  event_type      VARCHAR(100)  NOT NULL,
  actor_id        UUID          REFERENCES users(id),
  actor_email     VARCHAR(255),
  resource_type   VARCHAR(100),
  resource_id     UUID,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  ip_address      INET,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
-- Audit logs are NEVER updated or deleted - INSERT ONLY
CREATE INDEX idx_audit_event ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

---

## 6. KAFKA TOPICS & EVENT CONTRACTS

### 6.1 Topic Naming Convention

```
{domain}.{action}.{status}
{domain}.{action}.{status}.dlq    ← Dead Letter Queue variant
```

### 6.2 All Topics

| Topic | Producer | Consumers | Purpose |
|-------|---------|----------|---------|
| `workflow.instance.started` | Workflow | Analytics, Audit | Instance begins execution |
| `workflow.instance.completed` | Workflow | Analytics, Audit, Notif | Instance finishes |
| `workflow.instance.failed` | Workflow | Analytics, Audit, Notif | Instance fails |
| `workflow.step.started` | Workflow | Audit | Step begins |
| `workflow.step.completed` | Workflow | Workflow (self), Audit | Step finishes → advance |
| `task.create.requested` | Workflow | Task | Create a new task |
| `task.created` | Task | Notification, Audit | Task was created → notify |
| `task.completed` | Task | Workflow, Analytics, Audit | Task done → advance workflow |
| `task.expired` | Task (scheduler) | Notification, Audit | SLA breach detected |
| `notification.send.requested` | Task, Workflow | Notification | Send a notification |
| `notification.sent` | Notification | Audit | Notification delivered |
| `notification.failed` | Notification | Notification (DLQ) | Delivery failed |
| `notification.failed.dlq` | Notification | Audit, Alert | Max retries exceeded |
| `audit.event.created` | ALL services | Audit | Universal audit hook |

### 6.3 Event Schema Contracts (TypeScript interfaces in packages/shared)

```typescript
// packages/shared/src/types/events.types.ts

export interface BaseEvent {
  eventId: string;         // UUID - unique per event
  eventType: string;       // matches topic name
  tenantId: string;
  correlationId: string;   // links all events for one workflow instance
  timestamp: string;       // ISO 8601
  version: string;         // event schema version e.g., "1.0"
}

export interface WorkflowInstanceStartedEvent extends BaseEvent {
  eventType: 'workflow.instance.started';
  payload: {
    instanceId: string;
    workflowId: string;
    workflowVersion: number;
    triggeredBy: string;
    triggerData: Record<string, unknown>;
  };
}

export interface TaskCreateRequestedEvent extends BaseEvent {
  eventType: 'task.create.requested';
  payload: {
    instanceId: string;
    stepId: string;
    title: string;
    description: string;
    assigneeType: 'USER' | 'ROLE';
    assigneeValue: string;  // userId or role name
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    slaHours: number;
    formSchema: Record<string, unknown>;
  };
}

export interface TaskCompletedEvent extends BaseEvent {
  eventType: 'task.completed';
  payload: {
    taskId: string;
    instanceId: string;
    stepId: string;
    completedBy: string;
    decision: 'APPROVED' | 'REJECTED' | 'COMPLETED';
    formData: Record<string, unknown>;
  };
}

export interface NotificationSendRequestedEvent extends BaseEvent {
  eventType: 'notification.send.requested';
  payload: {
    instanceId: string;
    channel: 'EMAIL' | 'SLACK' | 'IN_APP';
    recipient: string;
    templateId: string;
    templateData: Record<string, unknown>;
    maxAttempts: number;
  };
}
```

### 6.4 Kafka Configuration

```typescript
// Producer config
const producerConfig = {
  allowAutoTopicCreation: false,
  transactionTimeout: 30000,
  idempotent: true,   // exactly-once producer semantics
};

// Consumer config
const consumerConfig = {
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
  retry: {
    initialRetryTime: 100,
    retries: 8,           // exponential backoff
  },
};

// All topics must be pre-created with:
// replicationFactor: 3 (production) | 1 (development)
// partitions: 6 (allows up to 6 consumers per group)
// retentionMs: 604800000 (7 days)
```

---

## 7. REDIS KEY PATTERNS

```typescript
// packages/shared/src/constants/redis.keys.ts

export const REDIS_KEYS = {
  // Auth
  REFRESH_TOKEN_BLACKLIST: (jti: string) => `blacklist:token:${jti}`,
  USER_SESSION: (userId: string) => `session:user:${userId}`,

  // Rate Limiting (via express-rate-limit + rate-limit-redis)
  RATE_LIMIT: (tenantId: string, ip: string) => `ratelimit:${tenantId}:${ip}`,

  // Distributed Locks (Redlock pattern)
  TASK_LOCK: (taskId: string) => `lock:task:${taskId}`,
  WORKFLOW_INSTANCE_LOCK: (instanceId: string) => `lock:instance:${instanceId}`,
  STEP_EXECUTION_LOCK: (instanceId: string, stepId: string) =>
    `lock:step:${instanceId}:${stepId}`,

  // Caching
  WORKFLOW_DEF: (tenantId: string, workflowId: string) =>
    `cache:tenant:${tenantId}:workflow:${workflowId}`,
  TENANT_META: (tenantId: string) => `cache:tenant:${tenantId}:meta`,
  USER_PERMISSIONS: (userId: string) => `cache:user:${userId}:permissions`,

  // Pub/Sub channels
  INSTANCE_STATUS_CHANNEL: (instanceId: string) =>
    `pubsub:instance:${instanceId}:status`,
} as const;

// TTLs (seconds)
export const REDIS_TTL = {
  WORKFLOW_DEF: 300,        // 5 minutes
  TENANT_META: 600,         // 10 minutes
  USER_PERMISSIONS: 300,    // 5 minutes
  DISTRIBUTED_LOCK: 30,     // 30 seconds max lock hold
} as const;
```

---

## 8. SERVICE SPECIFICATIONS

### 8.1 API Gateway (Port 4000)

**Responsibilities:**
- Single entry point for all external traffic
- JWT verification on every request (except /auth/*)
- Extract tenant_id from JWT, attach to request headers
- Per-tenant + per-IP rate limiting using Redis
- Request/response logging with correlation IDs
- Route proxying to downstream services
- No business logic whatsoever

**Routing Rules:**
```
/api/auth/*          → auth-service:4001
/api/users/*         → auth-service:4001
/api/workflows/*     → workflow-service:4002
/api/instances/*     → workflow-service:4002
/api/tasks/*         → task-service:4003
/api/notifications/* → notification-service:4004
/api/analytics/*     → analytics-service:4005
/api/audit/*         → audit-service:4007
/api/ai/*            → ai-service:4006
```

**Middleware Chain (in order):**
1. `correlationId` — attach `X-Correlation-ID` to every request
2. `requestLogger` — log method, path, tenant, correlation ID
3. `rateLimiter` — 100 requests/minute per tenant, 30/minute per IP
4. `jwtVerifier` — skip /auth/* paths; validate Bearer token; attach decoded payload
5. `tenantExtractor` — extract tenantId, set `X-Tenant-ID` header for downstream
6. `serviceProxy` — forward to correct service using http-proxy-middleware
7. `errorHandler` — catch proxy errors, return standard error response

**Rate Limit Response:**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Limit: 100/minute.",
  "retryAfter": 45
}
```

### 8.2 Auth Service (Port 4001)

**Responsibilities:**
- Tenant registration (creates PostgreSQL schema for new tenant)
- User registration and login
- JWT issuance (access token: 15min, refresh token: 7 days)
- Refresh token rotation (old token invalidated on refresh)
- Logout (blacklist token in Redis)
- RBAC permission checking (exported as middleware for other services)
- User CRUD within a tenant

**JWT Payload:**
```typescript
interface JWTPayload {
  sub: string;         // userId
  tenantId: string;
  tenantSlug: string;  // used for DB schema selection
  role: string;
  email: string;
  jti: string;         // unique token ID (for blacklisting)
  iat: number;
  exp: number;
}
```

**RBAC Permission Matrix:**

| Resource | Action | OWNER | ADMIN | MANAGER | MEMBER | VIEWER |
|---------|--------|-------|-------|---------|--------|--------|
| workflow | create | ✅ | ✅ | ❌ | ❌ | ❌ |
| workflow | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| workflow | publish | ✅ | ✅ | ❌ | ❌ | ❌ |
| workflow | delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| instance | trigger | ✅ | ✅ | ✅ | ✅ | ❌ |
| instance | cancel | ✅ | ✅ | ✅ | ❌ | ❌ |
| task | complete | ✅ | ✅ | ✅ | ✅ | ❌ |
| audit | read | ✅ | ✅ | ❌ | ❌ | ❌ |
| analytics | read | ✅ | ✅ | ✅ | ❌ | ❌ |
| user | manage | ✅ | ✅ | ❌ | ❌ | ❌ |

**Tenant Schema Provisioning (on registration):**
```typescript
async function provisionTenantSchema(tenantSlug: string): Promise<void> {
  const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;
  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await db.$executeRawUnsafe(`SET search_path = "${schemaName}"`);
  // Run all tenant table migrations
  await runTenantMigrations(schemaName);
  // Seed default permissions
  await seedDefaultPermissions(schemaName);
}
```

### 8.3 Workflow Service (Port 4002)

**Responsibilities:**
- Workflow definition CRUD (with versioning)
- State Machine Engine — the core of the platform
- Workflow instance lifecycle management
- Kafka consumer for task.completed events → advance state machine
- Triggering new instances (manual, webhook)

**State Machine Engine (`engine/state-machine.ts`):**

```typescript
// Core state machine implementation

type StepType = 'TASK' | 'NOTIFICATION' | 'CONDITION' | 'DELAY' | 'WEBHOOK' | 'AI_ACTION';
type InstanceStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface StateMachine {
  instanceId: string;
  currentStepIndex: number;
  steps: WorkflowStep[];
  context: Record<string, unknown>;
}

class WorkflowStateMachine {
  // Called when a new instance is triggered
  async start(instanceId: string): Promise<void>

  // Called by Kafka consumer when a step event arrives
  async advance(instanceId: string, stepResult: StepResult): Promise<void>

  // Evaluates a CONDITION step and determines next step index
  private async evaluateCondition(step: WorkflowStep, context: Record<string, unknown>): Promise<number>

  // Executes a single step by emitting the appropriate Kafka event
  private async executeStep(step: WorkflowStep, instance: WorkflowInstance): Promise<void>

  // Marks instance as COMPLETED or FAILED with optimistic locking
  private async finalizeInstance(instanceId: string, status: 'COMPLETED' | 'FAILED'): Promise<void>
}
```

**Optimistic Locking on WorkflowInstance:**
```typescript
// When advancing the state machine, always use version check:
const updated = await prisma.workflowInstance.updateMany({
  where: {
    id: instanceId,
    version: currentVersion,  // optimistic lock check
    status: 'RUNNING',
  },
  data: {
    currentStepId: nextStepId,
    version: { increment: 1 },
    updatedAt: new Date(),
  },
});

if (updated.count === 0) {
  throw new OptimisticLockError(`Instance ${instanceId} was modified concurrently`);
  // Retry logic: re-fetch and re-apply if appropriate
}
```

**Workflow Definition JSONB structure:**
```json
{
  "steps": [
    {
      "id": "step-uuid-1",
      "name": "Manager Approval",
      "type": "TASK",
      "order": 1,
      "config": {
        "assigneeType": "USER",
        "assignee": "{{context.employee.managerId}}",
        "slaHours": 48,
        "priority": "HIGH",
        "formSchema": {
          "fields": [
            { "name": "decision", "type": "radio", "options": ["APPROVED", "REJECTED"], "required": true },
            { "name": "comments", "type": "textarea", "required": false }
          ]
        }
      }
    },
    {
      "id": "step-uuid-2",
      "name": "Check Department",
      "type": "CONDITION",
      "order": 2,
      "config": {
        "expression": "$.context.employee.department === 'ENGINEERING'",
        "trueStepOrder": 3,
        "falseStepOrder": 4
      }
    },
    {
      "id": "step-uuid-3",
      "name": "Notify Engineering Slack",
      "type": "NOTIFICATION",
      "order": 3,
      "config": {
        "channel": "SLACK",
        "webhook": "{{tenant.slackWebhook}}",
        "template": "ENG_ONBOARDING",
        "isTerminal": false,
        "nextStepOrder": 5
      }
    }
  ]
}
```

### 8.4 Task Service (Port 4003)

**Responsibilities:**
- Consume `task.create.requested` Kafka events → create tasks in DB
- Task CRUD API for frontend (list, get, update)
- Task completion with form data submission
- SLA monitoring via a scheduled job (every 5 minutes, check for expired tasks)
- Distributed locking when completing a task (prevent double completion)
- Emit `task.completed` event for Workflow Service to consume

**Distributed Lock on Task Completion:**
```typescript
async function completeTask(taskId: string, userId: string, formData: object): Promise<void> {
  const lockKey = REDIS_KEYS.TASK_LOCK(taskId);
  const lockValue = `${userId}-${Date.now()}`;

  // Acquire Redis lock (Redlock pattern simplified)
  const acquired = await redis.set(lockKey, lockValue, 'NX', 'EX', REDIS_TTL.DISTRIBUTED_LOCK);

  if (!acquired) {
    throw new ConflictError('Task is being processed by another request');
  }

  try {
    // Optimistic locking on task row
    const result = await prisma.task.updateMany({
      where: { id: taskId, status: 'OPEN', version: currentVersion },
      data: {
        status: 'COMPLETED',
        completedBy: userId,
        completedAt: new Date(),
        formData,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new OptimisticLockError('Task state changed concurrently');
    }

    // Emit Kafka event
    await producer.send({ topic: 'task.completed', messages: [...] });
  } finally {
    // Always release the lock
    const currentLockValue = await redis.get(lockKey);
    if (currentLockValue === lockValue) {
      await redis.del(lockKey);
    }
  }
}
```

**SLA Expiry Scheduler:**
```typescript
// Runs every 5 minutes via setInterval or node-cron
async function checkExpiredTasks(): Promise<void> {
  const expiredTasks = await prisma.task.findMany({
    where: {
      status: 'OPEN',
      dueAt: { lt: new Date() },
    },
    take: 100,
  });

  for (const task of expiredTasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'EXPIRED' },
    });
    await producer.send({ topic: 'task.expired', messages: [{ key: task.id, value: JSON.stringify(task) }] });
  }
}
```

### 8.5 Notification Service (Port 4004)

**Responsibilities:**
- Consume `notification.send.requested` events
- Send via EMAIL (nodemailer) or SLACK (webhook)
- Retry logic with exponential backoff (3 attempts)
- Dead Letter Queue — after max retries, publish to `notification.failed.dlq`
- DLQ consumer for monitoring and manual reprocessing
- HTML email templates with mustache-style variable substitution

**Retry Handler:**
```typescript
interface RetryConfig {
  maxAttempts: number;   // 3
  baseDelayMs: number;   // 1000
  maxDelayMs: number;    // 30000
}

async function sendWithRetry(notification: Notification): Promise<void> {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(2, notification.attemptCount),
    config.maxDelayMs
  );

  try {
    await sendViaChannel(notification);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (error) {
    const nextAttempt = notification.attemptCount + 1;

    if (nextAttempt >= notification.maxAttempts) {
      // Send to DLQ
      await producer.send({
        topic: 'notification.failed.dlq',
        messages: [{ key: notification.id, value: JSON.stringify(notification) }],
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DEAD_LETTERED', error: error.message },
      });
    } else {
      // Schedule retry
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          attemptCount: nextAttempt,
          nextRetryAt: new Date(Date.now() + delay),
          status: 'PENDING',
          error: error.message,
        },
      });
      // Republish to main topic after delay (using Redis delayed queue or setTimeout)
    }
  }
}
```

### 8.6 Analytics Service (Port 4005)

**Responsibilities:**
- Consume workflow events to maintain `analytics_snapshots` table
- Daily aggregation job (midnight cron) for historical snapshots
- REST API for dashboard charts and metrics
- Bottleneck detection: identify steps with unusually high avg duration
- Real-time metrics exposed to Prometheus (instance completion rate, active instances count)

**Key Metrics:**
```typescript
// Metrics API response shape
interface WorkflowAnalytics {
  workflowId: string;
  period: '7d' | '30d' | '90d';
  summary: {
    totalInstances: number;
    completedInstances: number;
    failedInstances: number;
    completionRate: number;      // 0-1
    avgDurationMs: number;
    p50DurationMs: number;
    p95DurationMs: number;
  };
  dailyBreakdown: Array<{
    date: string;
    total: number;
    completed: number;
    failed: number;
  }>;
  stepMetrics: Array<{
    stepId: string;
    stepName: string;
    avgDurationMs: number;
    completionRate: number;
    isBottleneck: boolean;       // true if avg > 2x median step duration
  }>;
}
```

### 8.7 Audit Service (Port 4007)

**Responsibilities:**
- Subscribe to ALL Kafka topics (fan-out consumer group: `audit-service`)
- Write every event as an immutable record to `audit_logs` table
- Never delete, never update audit records
- Expose paginated audit log API with filtering by resource, actor, event type, date range
- Elasticsearch integration: index audit events for full-text search

**INSERT-ONLY enforcement:**
```typescript
// audit.service.ts — only exposes insert and query methods, NEVER update/delete
class AuditService {
  async record(event: BaseEvent, metadata: AuditMetadata): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO audit_logs (event_type, actor_id, resource_type, resource_id, metadata, created_at)
      VALUES (${event.eventType}, ${metadata.actorId}, ${metadata.resourceType},
              ${metadata.resourceId}, ${JSON.stringify(metadata)}::jsonb, NOW())
    `;
  }

  async query(filters: AuditQueryFilters, pagination: PaginationParams): Promise<PaginatedResult<AuditLog>> {
    // READ ONLY — standard paginated query
  }

  // NO update(), NO delete() methods exist in this service
}
```

### 8.8 AI Service (Port 4006)

**Responsibilities:**
- Natural language → workflow definition JSON (using LangChain + GPT-4o-mini)
- Workflow anomaly detection (step bottleneck identification)
- Smart assignee suggestion based on historical completion time

**Workflow Generator Chain:**
```typescript
// chains/workflow-generator.chain.ts

const WORKFLOW_SCHEMA = JSON.parse(
  fs.readFileSync('./prompts/workflow-schema.json', 'utf-8')
);

const SYSTEM_PROMPT = `
You are a workflow automation expert. Convert natural language descriptions
into a structured workflow definition JSON that matches the provided schema.

Rules:
- Every workflow must have at least one step
- TASK steps require assigneeType and assigneeValue
- CONDITION steps require expression, trueStepOrder, falseStepOrder
- NOTIFICATION steps require channel and templateId
- The last step should be a NOTIFICATION or have isTerminal: true
- Use context variables with {{context.variableName}} syntax for dynamic values
- Return ONLY valid JSON matching the schema. No explanation text.

Schema: ${JSON.stringify(WORKFLOW_SCHEMA, null, 2)}
`;

export class WorkflowGeneratorChain {
  async generate(userInput: string, tenantContext: TenantContext): Promise<WorkflowDefinition> {
    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const parser = new JsonOutputParser<WorkflowDefinition>();

    const chain = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['human', '{input}'],
    ]).pipe(llm).pipe(parser);

    const result = await chain.invoke({ input: userInput });

    // Validate output against Zod schema before returning
    return WorkflowDefinitionSchema.parse(result);
  }
}
```

---

## 9. ENGINEERING PATTERNS IMPLEMENTATION

### 9.1 State Machine

The state machine is the core of the platform. Implement it as a pure class with no
side effects — all I/O (DB reads/writes, Kafka publishing) is injected as dependencies.

```typescript
// workflow-service/src/engine/state-machine.ts

enum InstanceState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

const VALID_TRANSITIONS: Record<InstanceState, InstanceState[]> = {
  PENDING:   [RUNNING, CANCELLED],
  RUNNING:   [PAUSED, COMPLETED, FAILED, CANCELLED],
  PAUSED:    [RUNNING, CANCELLED],
  COMPLETED: [],   // terminal
  FAILED:    [],   // terminal
  CANCELLED: [],   // terminal
};

function canTransition(from: InstanceState, to: InstanceState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

### 9.2 Optimistic Locking

Applied to two tables: `workflow_instances.version` and `tasks.version`.

Implementation rule: always use `updateMany` with `WHERE id = X AND version = Y`.
Check `count === 0` to detect conflict. On conflict: re-fetch → re-apply → retry (max 3).

### 9.3 Distributed Locks (Redis Redlock)

Use for: task completion, workflow step advancement.

**Implementation:** Simplified Redlock with single Redis node (sufficient for dev/staging):
```
SET lock:{resource} {unique_value} NX EX {ttl_seconds}
```
- `NX` = only set if not exists
- `EX` = auto-expire after TTL (prevents deadlocks)
- Release: compare-and-delete (Lua script to ensure atomicity)

```lua
-- Redis Lua script for atomic compare-and-delete
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

### 9.4 Retry Queue & Dead Letter Queue

**Standard Retry Flow:**
```
notification.send.requested → attempt 1 (fail)
  → wait 1s  → attempt 2 (fail)
  → wait 2s  → attempt 3 (fail)
  → notification.failed.dlq
```

**DLQ Consumer behavior:**
- Logs to audit trail with severity CRITICAL
- Fires an alert to PagerDuty/Slack (configured webhook)
- Marks notification as DEAD_LETTERED in DB
- Exposes `/api/notifications/dlq` endpoint for manual reprocessing by admins

### 9.5 Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|------|----------|-----|-------------|
| Workflow definition | `cache:tenant:{id}:workflow:{id}` | 5min | On workflow update |
| Tenant metadata | `cache:tenant:{id}:meta` | 10min | On tenant update |
| User permissions | `cache:user:{id}:permissions` | 5min | On role change |

**Cache-aside pattern:**
```typescript
async function getWorkflow(tenantId: string, workflowId: string): Promise<Workflow> {
  const cacheKey = REDIS_KEYS.WORKFLOW_DEF(tenantId, workflowId);
  const cached = await redis.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const workflow = await prisma.workflows.findUniqueOrThrow({ where: { id: workflowId } });
  await redis.set(cacheKey, JSON.stringify(workflow), 'EX', REDIS_TTL.WORKFLOW_DEF);

  return workflow;
}

async function invalidateWorkflowCache(tenantId: string, workflowId: string): Promise<void> {
  await redis.del(REDIS_KEYS.WORKFLOW_DEF(tenantId, workflowId));
}
```

### 9.6 Rate Limiting

Two-tier rate limiting at API Gateway:
- **Tenant tier:** 1000 requests/minute per tenant (sliding window)
- **IP tier:** 100 requests/minute per IP (fixed window)
- **Endpoint-specific:** `/api/ai/*` = 20 requests/minute per user (LLM cost control)

### 9.7 Pagination

All list endpoints use **cursor-based pagination** (not offset-based — more performant at scale):

```typescript
interface PaginatedRequest {
  cursor?: string;    // last item's createdAt ISO string (base64 encoded)
  limit: number;      // default 20, max 100
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
    total?: number;   // only included when specifically requested
  };
}
```

### 9.8 Search (Elasticsearch)

Index: `workflows_{tenantId}`, `tasks_{tenantId}`, `instances_{tenantId}`

Search is triggered from:
- Workflow list: search by name, description
- Task list: search by title, description, assignee name
- Audit log: search by event type, actor email, resource ID

```typescript
// Sync to Elasticsearch via Kafka consumer in a dedicated sync worker
// On workflow.created / workflow.updated → index document
// On workflow.deleted → delete document
const workflowDoc = {
  id: workflow.id,
  name: workflow.name,
  description: workflow.description,
  status: workflow.status,
  createdAt: workflow.createdAt,
};
await esClient.index({ index: `workflows_${tenantId}`, id: workflow.id, document: workflowDoc });
```

### 9.9 Observability (OpenTelemetry)

Every service must initialize the OTel SDK before any other imports:

```typescript
// telemetry/src/tracer.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function initTelemetry(serviceName: string): void {
  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
        '@opentelemetry/instrumentation-kafkajs': { enabled: true },
      }),
    ],
  });
  sdk.start();
}
```

Custom span for workflow step execution:
```typescript
const tracer = trace.getTracer('workflow-service');

const span = tracer.startSpan('execute_workflow_step', {
  attributes: {
    'workflow.id': workflowId,
    'workflow.instance.id': instanceId,
    'step.id': stepId,
    'step.type': stepType,
    'tenant.id': tenantId,
  },
});

try {
  await executeStep(step, instance);
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
  throw error;
} finally {
  span.end();
}
```

---

## 10. API CONTRACTS

### 10.1 Standard Response Envelope

```typescript
// Success
{ "success": true, "data": { ... }, "meta": { "requestId": "...", "timestamp": "..." } }

// Error
{ "success": false, "error": { "code": "WORKFLOW_NOT_FOUND", "message": "...", "details": {} } }

// Paginated
{ "success": true, "data": [...], "pagination": { "nextCursor": "...", "hasNextPage": true } }
```

### 10.2 Auth Service Endpoints

```
POST   /auth/register-tenant     Register new tenant + owner account
POST   /auth/login               Login, returns { accessToken, refreshToken }
POST   /auth/refresh             Refresh access token
POST   /auth/logout              Revoke refresh token
GET    /users                    List users in tenant (ADMIN+)
POST   /users                    Create user (ADMIN+)
GET    /users/:id                Get user
PATCH  /users/:id                Update user (self or ADMIN+)
DELETE /users/:id                Deactivate user (ADMIN+)
PATCH  /users/:id/role           Change user role (OWNER only)
```

### 10.3 Workflow Service Endpoints

```
GET    /workflows                List workflows (paginated, searchable)
POST   /workflows                Create workflow (ADMIN+)
GET    /workflows/:id            Get workflow with steps
PUT    /workflows/:id            Update workflow definition (ADMIN+, only DRAFT)
DELETE /workflows/:id            Archive workflow (ADMIN+)
POST   /workflows/:id/publish    Publish workflow (ADMIN+)
POST   /workflows/:id/trigger    Manually trigger a workflow instance (MEMBER+)

GET    /instances                List instances (paginated, filterable by status)
GET    /instances/:id            Get instance with step execution history
POST   /instances/:id/cancel     Cancel running instance (MANAGER+)
POST   /instances/:id/retry      Retry failed instance (ADMIN+)
GET    /instances/:id/timeline   Get step-by-step execution timeline
```

### 10.4 Task Service Endpoints

```
GET    /tasks                    List tasks (assignee=me filter default)
GET    /tasks/:id                Get task with form schema
POST   /tasks/:id/complete       Complete task with form data
POST   /tasks/:id/reject         Reject task with reason
POST   /tasks/:id/reassign       Reassign task (MANAGER+)
GET    /tasks/:id/comments       Get comments
POST   /tasks/:id/comments       Add comment
GET    /tasks/overdue            List overdue tasks (MANAGER+)
```

### 10.5 Analytics Service Endpoints

```
GET    /analytics/overview       Tenant-wide summary metrics
GET    /analytics/workflows/:id  Per-workflow metrics (period=7d|30d|90d)
GET    /analytics/bottlenecks    Top bottleneck steps across all workflows
GET    /analytics/activity       Daily activity chart data
```

### 10.6 AI Service Endpoints

```
POST   /ai/generate-workflow     { "prompt": "...", "context": {} } → workflow definition
POST   /ai/suggest-steps         Suggest next steps given current workflow
POST   /ai/detect-anomalies      Analyze workflow for performance anomalies
```

---

## 11. TEST STRATEGY

### 11.1 Test Pyramid

```
         [E2E Tests]         ← Playwright, 10-15 key user flows
        [Integration]        ← Supertest + TestContainers, per service
      [Unit Tests]           ← Jest, all business logic
```

**Target coverage: 80%+ across all services (enforced in CI)**

### 11.2 Unit Tests (Jest + ts-jest)

Every function with business logic gets a unit test. Key areas:

```typescript
// workflow-service/src/engine/state-machine.test.ts

describe('WorkflowStateMachine', () => {
  describe('canTransition', () => {
    it('should allow PENDING → RUNNING transition', ...)
    it('should reject COMPLETED → RUNNING transition', ...)
    it('should reject all transitions from terminal states', ...)
  })

  describe('evaluateCondition', () => {
    it('should return trueStepOrder when expression is truthy', ...)
    it('should return falseStepOrder when expression is falsy', ...)
    it('should handle nested context variable access', ...)
    it('should throw on invalid JSONPath expression', ...)
  })

  describe('advance', () => {
    it('should increment version on successful state advance', ...)
    it('should throw OptimisticLockError on concurrent modification', ...)
    it('should emit task.create.requested for TASK step type', ...)
    it('should emit notification.send.requested for NOTIFICATION step type', ...)
    it('should mark instance COMPLETED on final step', ...)
  })
})

// task-service/src/services/task.service.test.ts

describe('TaskService', () => {
  describe('completeTask', () => {
    it('should acquire Redis lock before completing', ...)
    it('should release lock even if completion fails', ...)
    it('should throw ConflictError if lock already held', ...)
    it('should throw OptimisticLockError on version mismatch', ...)
    it('should emit task.completed event on success', ...)
  })
})
```

### 11.3 Integration Tests (Supertest + TestContainers)

Use TestContainers to spin up real PostgreSQL and Redis for integration tests:

```typescript
// workflow-service/__tests__/integration/workflow.integration.test.ts

import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('Workflow API Integration', () => {
  beforeAll(async () => {
    const pgContainer = await new PostgreSqlContainer().start();
    // Run migrations against test DB
    // Start service with test DB URL
  })

  it('POST /workflows should create workflow and return 201', ...)
  it('POST /workflows/:id/publish should change status to ACTIVE', ...)
  it('POST /workflows/:id/trigger should create instance and return instanceId', ...)
  it('GET /instances/:id/timeline should return ordered step executions', ...)
})
```

### 11.4 E2E Tests (Playwright)

```typescript
// e2e/tests/employee-onboarding.spec.ts

test('Complete employee onboarding workflow end-to-end', async ({ page }) => {
  // 1. Login as admin
  await loginAs(page, 'admin@acme.com');

  // 2. Create onboarding workflow via UI
  await page.goto('/workflows/new');
  await buildOnboardingWorkflow(page);

  // 3. Publish workflow
  await page.click('[data-testid="publish-btn"]');
  await expect(page.getByText('Workflow Published')).toBeVisible();

  // 4. Trigger workflow as HR user
  await loginAs(page, 'hr@acme.com');
  await triggerWorkflow(page, 'employee-onboarding', { employeeId: 'test-001' });

  // 5. Complete manager approval task
  await loginAs(page, 'manager@acme.com');
  await completeTask(page, { decision: 'APPROVED', comments: 'Looks good' });

  // 6. Verify workflow instance shows COMPLETED
  await expect(page.getByText('COMPLETED')).toBeVisible({ timeout: 10000 });
})
```

### 11.5 CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
      redis:
        image: redis:7
      kafka:
        image: confluentinc/cp-kafka:7.6.0

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test:unit --coverage
      - run: pnpm run test:integration
      - name: Check coverage threshold
        run: pnpm run coverage:check  # fails if below 80%
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
```

---

## 12. OBSERVABILITY STACK

### 12.1 Prometheus Metrics (per service)

Each service exposes `/metrics` in Prometheus format via `prom-client`:

```typescript
// Custom metrics every service should instrument

// Histogram: HTTP request duration
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
});

// Counter: Kafka events processed
const kafkaEventsProcessed = new Counter({
  name: 'kafka_events_processed_total',
  help: 'Total Kafka events consumed',
  labelNames: ['topic', 'status', 'service'],
});

// Gauge: Active workflow instances
const activeInstances = new Gauge({
  name: 'workflow_instances_active',
  help: 'Number of currently running workflow instances',
  labelNames: ['workflow_id', 'tenant_id'],
});

// Histogram: Workflow step execution duration
const stepExecutionDuration = new Histogram({
  name: 'workflow_step_duration_ms',
  help: 'Time to execute a single workflow step',
  labelNames: ['step_type', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
});

// Counter: Notification delivery outcomes
const notificationOutcomes = new Counter({
  name: 'notifications_total',
  help: 'Total notification delivery attempts',
  labelNames: ['channel', 'status'],
});

// Counter: DLQ events
const dlqEvents = new Counter({
  name: 'dlq_events_total',
  help: 'Total events reaching Dead Letter Queue',
  labelNames: ['topic'],
});
```

### 12.2 Grafana Dashboard Panels

Create one dashboard `EWAP Overview` with these panels:

1. **Request Rate** — `rate(http_request_duration_ms_count[5m])` per service
2. **P95 Latency** — `histogram_quantile(0.95, http_request_duration_ms_bucket)` per service
3. **Error Rate** — `rate(http_requests_total{status_code=~"5.."}[5m])` / total
4. **Active Workflow Instances** — `sum(workflow_instances_active)` gauge
5. **Workflow Completion Rate (1h)** — completed / started instances
6. **Kafka Consumer Lag** — per consumer group
7. **DLQ Events** — `increase(dlq_events_total[1h])` — alert if > 0
8. **SLO Panel** — 99.5% of requests under 500ms (green/red SLO indicator)

### 12.3 Alerting Rules (Prometheus AlertManager)

```yaml
groups:
  - name: ewap.alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Error rate above 5% on {{ $labels.service }}"

      - alert: DLQEventDetected
        expr: increase(dlq_events_total[5m]) > 0
        for: 0m
        labels: { severity: warning }
        annotations:
          summary: "Dead Letter Queue has events — notification delivery failing"

      - alert: WorkflowInstanceStuck
        expr: workflow_instances_active > 0 and
              time() - workflow_instance_last_advanced > 3600
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "Workflow instance has not advanced in 1 hour"
```

---

## 13. DOCKER & KUBERNETES

### 13.1 docker-compose.yml (Development)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ewap
      POSTGRES_USER: ewap
      POSTGRES_PASSWORD: ewap_dev_pass
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
    volumes: [redis_data:/data]

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on: [zookeeper]
    ports: ["9092:9092"]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: false

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports: ["8080:8080"]
    environment:
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092

  elasticsearch:
    image: elasticsearch:8.13.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: false
    ports: ["9200:9200"]

  jaeger:
    image: jaegertracing/all-in-one:1.57
    ports:
      - "16686:16686"   # Jaeger UI
      - "4318:4318"     # OTLP HTTP receiver

  prometheus:
    image: prom/prometheus:v2.52.0
    ports: ["9090:9090"]
    volumes: [./infrastructure/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml]

  grafana:
    image: grafana/grafana:10.4.0
    ports: ["3001:3000"]
    volumes: [grafana_data:/var/lib/grafana]
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: true

  api-gateway:
    build: ./services/api-gateway
    ports: ["4000:4000"]
    env_file: .env
    depends_on: [redis, kafka]

  auth-service:
    build: ./services/auth-service
    ports: ["4001:4001"]
    env_file: .env
    depends_on: [postgres, redis]

  workflow-service:
    build: ./services/workflow-service
    ports: ["4002:4002"]
    env_file: .env
    depends_on: [postgres, redis, kafka]

  task-service:
    build: ./services/task-service
    ports: ["4003:4003"]
    env_file: .env
    depends_on: [postgres, redis, kafka]

  notification-service:
    build: ./services/notification-service
    ports: ["4004:4004"]
    env_file: .env
    depends_on: [kafka]

  analytics-service:
    build: ./services/analytics-service
    ports: ["4005:4005"]
    env_file: .env
    depends_on: [postgres, kafka]

  ai-service:
    build: ./services/ai-service
    ports: ["4006:4006"]
    env_file: .env

  audit-service:
    build: ./services/audit-service
    ports: ["4007:4007"]
    env_file: .env
    depends_on: [postgres, kafka, elasticsearch]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]

volumes:
  postgres_data:
  redis_data:
  grafana_data:
```

### 13.2 Dockerfile (Standard for all services)

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## 14. ENVIRONMENT VARIABLES

```bash
# .env.example — copy to .env and fill values

# Database
DATABASE_URL=postgresql://ewap:ewap_dev_pass@localhost:5432/ewap

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=ewap-services
KAFKA_GROUP_ID_PREFIX=ewap

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=ewap  # overridden per service

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Email (use Mailtrap for dev)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
SMTP_FROM=noreply@ewap.dev

# AI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
AI_RATE_LIMIT_MAX=20

# Service URLs (used by API Gateway)
AUTH_SERVICE_URL=http://auth-service:4001
WORKFLOW_SERVICE_URL=http://workflow-service:4002
TASK_SERVICE_URL=http://task-service:4003
NOTIFICATION_SERVICE_URL=http://notification-service:4004
ANALYTICS_SERVICE_URL=http://analytics-service:4005
AI_SERVICE_URL=http://ai-service:4006
AUDIT_SERVICE_URL=http://audit-service:4007

# Environment
NODE_ENV=development
LOG_LEVEL=debug
```

---

## 15. IMPLEMENTATION PHASES

### Phase 1 — Core Foundation (Weeks 1-4)

**Goal:** One full workflow can be created, triggered, and completed. Infrastructure running.

**Week 1:**
- [ ] Initialize monorepo with pnpm workspaces
- [ ] Set up `packages/shared` with all TypeScript types and constants
- [ ] Set up `packages/kafka-client` with producer/consumer factory
- [ ] Set up `packages/telemetry` with OpenTelemetry init
- [ ] Docker Compose with Postgres, Redis, Kafka, Jaeger, Prometheus, Grafana up
- [ ] Create Kafka topics via init script (all topics with correct partition/retention config)
- [ ] Auth Service: tenant registration, login, JWT issuance, refresh
- [ ] Database schema provisioning on tenant creation

**Week 2:**
- [ ] API Gateway: routing, JWT middleware, rate limiting, correlation IDs
- [ ] Workflow Service: CRUD API for workflows and steps
- [ ] Workflow Service: State Machine Engine (core class, pure functions)
- [ ] Workflow Service: Instance creation + PENDING→RUNNING transition
- [ ] Task Service: Kafka consumer for `task.create.requested`
- [ ] Task Service: Task creation + assignment

**Week 3:**
- [ ] Task Service: Task completion with optimistic locking + distributed lock
- [ ] Task Service: `task.completed` producer
- [ ] Workflow Service: Consumer for `task.completed` → advance state machine
- [ ] Workflow Service: COMPLETED/FAILED terminal state handling
- [ ] Notification Service: Email channel (nodemailer + mailtrap)
- [ ] Notification Service: Retry handler + DLQ

**Week 4:**
- [ ] End-to-end test: Create employee onboarding workflow, trigger, complete all steps
- [ ] Fix all bugs found in E2E test
- [ ] Unit tests for state machine, task completion, retry handler
- [ ] OpenTelemetry traces working and visible in Jaeger
- [ ] Basic Prometheus metrics live for all 5 services

---

### Phase 2 — Advanced Features (Weeks 5-8)

**Goal:** Full feature set, search, analytics, audit, and frontend.

**Week 5:**
- [ ] RBAC: full permission matrix implemented in auth-service
- [ ] RBAC middleware exported and used in all services
- [ ] CONDITION step type in state machine (JSONPath expression evaluator)
- [ ] DELAY step type (setTimeout-based for now, Kafka delayed message for prod)
- [ ] Notification Service: Slack webhook channel
- [ ] Elasticsearch: sync workers for workflow and task indexing
- [ ] Search API in Workflow and Task services

**Week 6:**
- [ ] Audit Service: fan-out consumer for all topics, INSERT-ONLY audit_logs
- [ ] Audit log API with pagination and filtering
- [ ] Analytics Service: consumers + daily snapshot aggregation
- [ ] Analytics API: overview metrics, per-workflow metrics, bottleneck detection
- [ ] SLA expiry scheduler in Task Service (node-cron, every 5 minutes)
- [ ] Task expiry → `task.expired` event → notification

**Week 7:**
- [ ] React Frontend: project setup (Vite + React 18 + Tailwind + React Query)
- [ ] Login page + JWT storage + axios interceptor
- [ ] Dashboard page: overview metrics cards
- [ ] Workflow list page with search
- [ ] Task list page (My Tasks, filtered by logged-in user)
- [ ] Task completion modal with dynamic form schema rendering

**Week 8:**
- [ ] React Flow workflow builder canvas (drag-and-drop steps)
- [ ] Step configuration panel (right sidebar per step type)
- [ ] Analytics page with Recharts (completion rate, daily activity, step metrics)
- [ ] Audit log page with infinite scroll
- [ ] Integration tests for all services using TestContainers
- [ ] E2E test suite (5 core flows) with Playwright

---

### Phase 3 — AI Layer + Production Hardening (Weeks 9-12)

**Goal:** AI service, multi-tenant validation, Kubernetes deployment, full test coverage.

**Week 9:**
- [ ] AI Service: WorkflowGeneratorChain (LangChain + GPT-4o-mini)
- [ ] AI Service: `/ai/generate-workflow` endpoint with Zod validation of LLM output
- [ ] Frontend: AI workflow creation modal ("Describe your workflow in plain English")
- [ ] AI Service: Anomaly detection for step bottlenecks
- [ ] Rate limiting for AI endpoints (20 req/min per user)

**Week 10:**
- [ ] Multi-tenant validation: provision 3 test tenants, verify complete data isolation
- [ ] Load testing with k6: 100 concurrent users triggering workflows simultaneously
- [ ] Fix performance bottlenecks surfaced by k6 (add DB indexes, tune connection pool)
- [ ] WEBHOOK trigger type: endpoint that accepts external webhooks to start instances
- [ ] Grafana dashboard: all panels configured with correct Prometheus queries

**Week 11:**
- [ ] Kubernetes Helm chart for all services
- [ ] Horizontal Pod Autoscaler on workflow-service and task-service
- [ ] GitHub Actions: full CI pipeline (lint → typecheck → unit → integration → build)
- [ ] GitHub Actions: deploy to k8s on main branch merge (via Helm upgrade)
- [ ] Secrets management via Kubernetes secrets / .env injection

**Week 12:**
- [ ] Bring total test coverage above 80% in all services (add missing tests)
- [ ] Performance: Redis caching for hot workflow definitions (verify cache hits in Grafana)
- [ ] Documentation: README with architecture diagram, setup guide, API reference
- [ ] Record demo video: 5-minute walkthrough of all major features
- [ ] Final resume bullets with actual metric numbers from load tests

---

## 16. AGENTIC IDE RULES

### 16.1 Rules for Cursor / Windsurf / Aider

Paste these as `.cursorrules` or in the agentic IDE system prompt:

```
PROJECT: Enterprise Workflow Automation Platform (EWAP)
PRD: /PRD.md (this file)

STRICT RULES — NEVER VIOLATE:

1. MONOREPO STRUCTURE
   - All services live in /services/{service-name}/
   - All shared code lives in /packages/shared/, /packages/kafka-client/, /packages/telemetry/
   - NEVER import from one service into another service directly
   - Inter-service communication ONLY via Kafka events (topic contracts in packages/shared)

2. TYPESCRIPT
   - Strict mode enabled in all tsconfig.json files
   - NO `any` types — use unknown + type guards
   - All Kafka event payloads must use the interfaces from packages/shared/src/types/events.types.ts
   - All request/response bodies validated with Zod before use

3. DATABASE
   - ALL DB queries go through Prisma client — NO raw SQL except for schema operations
   - ALWAYS switch search_path before Prisma queries: await db.$executeRaw`SET search_path = ${schemaName}`
   - NEVER query across tenant schemas — each request has exactly one tenantId context
   - Audit logs are INSERT-ONLY — audit.service.ts must have NO update or delete methods

4. OPTIMISTIC LOCKING
   - workflow_instances.version and tasks.version MUST be used for concurrent updates
   - Use updateMany with version check — check count === 0 to detect conflicts
   - On conflict: throw OptimisticLockError (do not silently ignore)

5. DISTRIBUTED LOCKS
   - Redis locks REQUIRED before: task completion, workflow step advancement
   - Lock acquisition uses SET NX EX pattern
   - Lock release uses Lua compare-and-delete script
   - Always release locks in finally block

6. KAFKA
   - Producers: set idempotent: true
   - ALL events must have: eventId, tenantId, correlationId, timestamp, version
   - DLQ topic naming: {original-topic}.dlq
   - Max retry: 3 attempts with exponential backoff before DLQ

7. ERROR HANDLING
   - ALL Express route handlers must use try/catch and pass errors to next(error)
   - Custom error classes: NotFoundError, UnauthorizedError, ForbiddenError, ConflictError,
     OptimisticLockError, ValidationError, RateLimitError
   - NEVER expose stack traces in production responses

8. OBSERVABILITY
   - initTelemetry() must be the FIRST call in every service's index.ts (before Express init)
   - Every significant operation must have an OTel span
   - Every Kafka consumer must increment kafkaEventsProcessed counter
   - HTTP middleware must record httpRequestDuration histogram

9. TESTING
   - Unit test files: same directory as source, {name}.test.ts
   - Integration test files: /services/{name}/__tests__/integration/
   - Minimum 80% coverage enforced — test:coverage script must fail below threshold
   - NEVER mock Prisma in integration tests — use TestContainers with real PostgreSQL

10. ENVIRONMENT
    - NEVER hardcode credentials, URLs, or secrets
    - ALL config loaded from environment variables via process.env
    - Validate required env vars at startup (throw if missing)
    - Use .env.example as the reference — never commit .env

11. FRONTEND
    - Use React Query for ALL server state — no useState for server data
    - Use Zustand ONLY for client-side UI state (workflow builder canvas state)
    - ALL API calls through /frontend/src/api/client.ts (axios instance with interceptor)
    - JWT stored in memory only (NOT localStorage) — use refresh token in httpOnly cookie
```

### 16.2 Phase 1 Starter Prompt (Copy-Paste into Agentic IDE)

```
I am building the Enterprise Workflow Automation Platform (EWAP) as described in PRD.md.

Start Phase 1, Week 1 implementation:

1. Initialize the pnpm monorepo with workspace configuration covering:
   - packages/shared
   - packages/kafka-client
   - packages/telemetry
   - services/api-gateway
   - services/auth-service
   - services/workflow-service
   - services/task-service
   - services/notification-service
   - services/analytics-service
   - services/audit-service
   - services/ai-service
   - frontend

2. Create packages/shared with:
   - All TypeScript interfaces from Section 6.3 (Kafka event contracts)
   - Redis key patterns from Section 7
   - Kafka topic constants
   - Pagination utility types

3. Create packages/kafka-client with producer and consumer factory functions
   using the config from Section 6.4

4. Create packages/telemetry with OpenTelemetry initialization from Section 9.9

5. Create the auth-service with:
   - PostgreSQL schema provisioning for new tenants (Section 8.2)
   - /auth/register-tenant, /auth/login, /auth/refresh, /auth/logout endpoints
   - JWT issuance with the payload shape from Section 8.2
   - User model from Section 5.2

6. Create docker-compose.yml from Section 13.1

7. Create a Kafka topics init script that creates all topics from Section 6.2
   with replicationFactor:1 and partitions:6

Follow all rules from Section 16.1 strictly. Use TypeScript strict mode.
Use Zod for all request validation. Use Prisma for all database access.
Reference PRD.md for all architectural decisions.
```

---

## APPENDIX: METRIC TARGETS (For Resume Bullets)

Once built, measure and record these numbers. They become your resume bullets.

| Metric | Target | Where to Measure |
|--------|--------|-----------------|
| API Gateway p95 latency | < 50ms | Grafana HTTP panel |
| Workflow step execution p95 | < 500ms | Custom OTel histogram |
| Kafka consumer lag | < 100 messages | Kafka UI |
| Notification delivery rate | > 99% | Prometheus notif counter |
| Test coverage | > 80% | Jest coverage report |
| Concurrent workflows under load | 500 simultaneous | k6 load test output |
| DLQ events per 1000 notifications | < 2 | Prometheus DLQ counter |
| Workflow completion rate | > 95% | Analytics service API |

**Final Resume Bullets (fill in your actual numbers):**

> Architected a multi-tenant Enterprise Workflow Automation Platform with 8 microservices,
> custom state machine engine, and Kafka-driven async execution — handling {X} concurrent
> workflow instances at {Y}ms p95 latency under k6 load testing.

> Implemented distributed locking (Redis Redlock), optimistic concurrency control, and a
> Dead Letter Queue retry system achieving {Z}% notification delivery rate. Maintained {N}%
> test coverage across unit, integration, and Playwright E2E suites via GitHub Actions CI.

> Integrated full observability stack (OpenTelemetry distributed tracing, Prometheus metrics,
> Grafana SLO dashboards) and an AI-powered natural language workflow generator using
> LangChain + GPT-4o-mini, reducing workflow creation time by {X}%.

---

*PRD Version: 1.0 | Last Updated: June 2026 | Author: EWAP Engineering*
```
