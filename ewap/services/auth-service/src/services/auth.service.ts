// services/auth-service/src/services/auth.service.ts
// Complete auth service implementation per PRD §8.2

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  JWTPayload,
  UserRole,
  RegisterTenantInput,
  getTenantSchemaName,
  validateTenantSlug,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '@ewap/shared';

export class AuthService {
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  // ─── Tenant Registration ────────────────────────────────────────────────────

  async registerTenant(input: RegisterTenantInput): Promise<{ accessToken: string; refreshToken: string }> {
    const { tenantName, tenantSlug, ownerEmail, ownerPassword, ownerFirstName, ownerLastName } = input;

    // Validate slug
    if (!validateTenantSlug(tenantSlug)) {
      throw new ValidationError(
        'Tenant slug must be 3-50 characters, lowercase alphanumeric with hyphens only',
      );
    }

    // Check slug uniqueness
    const existing = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (existing) {
      throw new ConflictError(`Tenant slug '${tenantSlug}' is already taken`);
    }

    // Create tenant record
    const tenant = await this.prisma.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        plan: 'FREE',
        status: 'ACTIVE',
        settings: {},
      },
    });

    // Provision tenant schema + tables
    await this.provisionTenantSchema(tenantSlug);

    // Create owner user in tenant schema
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const schemaName = getTenantSchemaName(tenantSlug);

    const [owner] = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO "${schemaName}".users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'OWNER') RETURNING id`,
      ownerEmail,
      passwordHash,
      ownerFirstName,
      ownerLastName,
    );

    // Issue tokens
    return this.issueTokens({
      sub: owner.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: 'OWNER',
      email: ownerEmail,
    });
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string, tenantSlug: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const schemaName = getTenantSchemaName(tenantSlug);

    const [user] = await this.prisma.$queryRawUnsafe<Array<{
      id: string; email: string; password_hash: string; role: UserRole; is_active: boolean
    }>>(
      `SELECT id, email, password_hash, role, is_active FROM "${schemaName}".users WHERE email = $1`,
      email,
    );

    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (!user.is_active) throw new UnauthorizedError('Account is deactivated');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    // Update last_login_at
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".users SET last_login_at = NOW() WHERE id = $1`,
      user.id,
    );

    return this.issueTokens({
      sub: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role,
      email: user.email,
    });
  }

  // ─── Token Refresh ──────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JWTPayload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JWTPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Check not blacklisted
    const blacklisted = await this.redis.get(`blacklist:token:${payload.jti}`);
    if (blacklisted) throw new UnauthorizedError('Token has been revoked');

    // Blacklist old refresh token
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:token:${payload.jti}`, '1', 'EX', ttl);
    }

    // Issue new tokens
    return this.issueTokens({
      sub: payload.sub,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      role: payload.role,
      email: payload.email,
    });
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async logout(accessToken: string): Promise<void> {
    try {
      const payload = jwt.decode(accessToken) as JWTPayload | null;
      if (payload?.jti) {
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.set(`blacklist:token:${payload.jti}`, '1', 'EX', ttl);
        }
      }
    } catch {
      // Ignore decode errors on logout
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async issueTokens(claims: Omit<JWTPayload, 'jti' | 'iat' | 'exp'>): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = uuidv4();

    const accessToken = jwt.sign(
      { ...claims, jti },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' },
    );

    const refreshToken = jwt.sign(
      { ...claims, jti: uuidv4() },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d' },
    );

    return { accessToken, refreshToken };
  }

  private async provisionTenantSchema(tenantSlug: string): Promise<void> {
    const schemaName = getTenantSchemaName(tenantSlug);

    // Create schema
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Run all tenant table migrations
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255)  UNIQUE NOT NULL,
        password_hash   VARCHAR(255)  NOT NULL,
        first_name      VARCHAR(100)  NOT NULL,
        last_name       VARCHAR(100)  NOT NULL,
        role            VARCHAR(50)   NOT NULL DEFAULT 'MEMBER',
        department      VARCHAR(100),
        manager_id      UUID          REFERENCES "${schemaName}".users(id),
        is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
        last_login_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".refresh_tokens (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID          NOT NULL REFERENCES "${schemaName}".users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(255)  UNIQUE NOT NULL,
        expires_at  TIMESTAMPTZ   NOT NULL,
        is_revoked  BOOLEAN       NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".permissions (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100)  UNIQUE NOT NULL,
        resource    VARCHAR(50)   NOT NULL,
        action      VARCHAR(50)   NOT NULL,
        description TEXT
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".role_permissions (
        role          VARCHAR(50)   NOT NULL,
        permission_id UUID          REFERENCES "${schemaName}".permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role, permission_id)
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".workflows (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255)  NOT NULL,
        description     TEXT,
        status          VARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
        version         INTEGER       NOT NULL DEFAULT 1,
        trigger_type    VARCHAR(50)   NOT NULL,
        trigger_config  JSONB         NOT NULL DEFAULT '{}',
        definition      JSONB         NOT NULL DEFAULT '{"steps": [], "transitions": []}',
        created_by      UUID          NOT NULL REFERENCES "${schemaName}".users(id),
        updated_by      UUID          REFERENCES "${schemaName}".users(id),
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".workflow_steps (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id     UUID          NOT NULL REFERENCES "${schemaName}".workflows(id) ON DELETE CASCADE,
        step_order      INTEGER       NOT NULL,
        name            VARCHAR(255)  NOT NULL,
        step_type       VARCHAR(50)   NOT NULL,
        config          JSONB         NOT NULL DEFAULT '{}',
        is_terminal     BOOLEAN       NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".workflow_instances (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id       UUID          NOT NULL REFERENCES "${schemaName}".workflows(id),
        workflow_version  INTEGER       NOT NULL,
        status            VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
        current_step_id   UUID          REFERENCES "${schemaName}".workflow_steps(id),
        context           JSONB         NOT NULL DEFAULT '{}',
        triggered_by      UUID          REFERENCES "${schemaName}".users(id),
        trigger_data      JSONB         NOT NULL DEFAULT '{}',
        started_at        TIMESTAMPTZ,
        completed_at      TIMESTAMPTZ,
        failed_at         TIMESTAMPTZ,
        failure_reason    TEXT,
        version           INTEGER       NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".instance_step_executions (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id     UUID          NOT NULL REFERENCES "${schemaName}".workflow_instances(id) ON DELETE CASCADE,
        step_id         UUID          NOT NULL REFERENCES "${schemaName}".workflow_steps(id),
        status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        duration_ms     INTEGER,
        output          JSONB         NOT NULL DEFAULT '{}',
        error           TEXT,
        attempt_count   INTEGER       NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id     UUID          NOT NULL REFERENCES "${schemaName}".workflow_instances(id),
        step_id         UUID          NOT NULL REFERENCES "${schemaName}".workflow_steps(id),
        title           VARCHAR(255)  NOT NULL,
        description     TEXT,
        status          VARCHAR(50)   NOT NULL DEFAULT 'OPEN',
        priority        VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM',
        assignee_id     UUID          REFERENCES "${schemaName}".users(id),
        assignee_role   VARCHAR(100),
        due_at          TIMESTAMPTZ,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        completed_by    UUID          REFERENCES "${schemaName}".users(id),
        form_data       JSONB         NOT NULL DEFAULT '{}',
        comments        JSONB         NOT NULL DEFAULT '[]',
        version         INTEGER       NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".notifications (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id     UUID          REFERENCES "${schemaName}".workflow_instances(id),
        channel         VARCHAR(50)   NOT NULL,
        recipient       VARCHAR(255)  NOT NULL,
        template_id     VARCHAR(100)  NOT NULL,
        payload         JSONB         NOT NULL DEFAULT '{}',
        status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
        attempt_count   INTEGER       NOT NULL DEFAULT 0,
        max_attempts    INTEGER       NOT NULL DEFAULT 3,
        next_retry_at   TIMESTAMPTZ,
        sent_at         TIMESTAMPTZ,
        error           TEXT,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".analytics_snapshots (
        id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id           UUID          REFERENCES "${schemaName}".workflows(id),
        snapshot_date         DATE          NOT NULL,
        total_instances       INTEGER       NOT NULL DEFAULT 0,
        completed_instances   INTEGER       NOT NULL DEFAULT 0,
        failed_instances      INTEGER       NOT NULL DEFAULT 0,
        avg_duration_ms       BIGINT,
        p50_duration_ms       BIGINT,
        p95_duration_ms       BIGINT,
        step_metrics          JSONB         NOT NULL DEFAULT '{}',
        created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE(workflow_id, snapshot_date)
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
        id              BIGSERIAL     PRIMARY KEY,
        event_type      VARCHAR(100)  NOT NULL,
        actor_id        UUID          REFERENCES "${schemaName}".users(id),
        actor_email     VARCHAR(255),
        resource_type   VARCHAR(100),
        resource_id     UUID,
        before_state    JSONB,
        after_state     JSONB,
        metadata        JSONB         NOT NULL DEFAULT '{}',
        ip_address      INET,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_users_email ON "${schemaName}".users(email)`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_users_role ON "${schemaName}".users(role)`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_workflows_status ON "${schemaName}".workflows(status)`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_instances_status ON "${schemaName}".workflow_instances(status, created_at DESC)`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON "${schemaName}".tasks(assignee_id, status)`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_audit_event ON "${schemaName}".audit_logs(event_type, created_at DESC)`);

    // Seed default permissions
    await this.seedDefaultPermissions(schemaName);

    console.log(`[Auth] Tenant schema '${schemaName}' provisioned successfully`);
  }

  private async seedDefaultPermissions(schemaName: string): Promise<void> {
    const permissions = [
      { name: 'workflow:create', resource: 'workflow', action: 'create' },
      { name: 'workflow:read', resource: 'workflow', action: 'read' },
      { name: 'workflow:publish', resource: 'workflow', action: 'publish' },
      { name: 'workflow:delete', resource: 'workflow', action: 'delete' },
      { name: 'instance:trigger', resource: 'instance', action: 'trigger' },
      { name: 'instance:cancel', resource: 'instance', action: 'cancel' },
      { name: 'task:complete', resource: 'task', action: 'complete' },
      { name: 'audit:read', resource: 'audit', action: 'read' },
      { name: 'analytics:read', resource: 'analytics', action: 'read' },
      { name: 'user:manage', resource: 'user', action: 'manage' },
    ];

    for (const perm of permissions) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".permissions (name, resource, action) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
        perm.name,
        perm.resource,
        perm.action,
      );
    }
  }
}
