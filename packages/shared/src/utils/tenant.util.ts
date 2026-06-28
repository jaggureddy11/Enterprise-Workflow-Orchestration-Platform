// packages/shared/src/utils/tenant.util.ts
// Tenant schema name generation per PRD §3.2

/**
 * Derives PostgreSQL schema name from tenant slug.
 * slug "acme-corp" → schema "tenant_acme_corp"
 */
export function getTenantSchemaName(tenantSlug: string): string {
  return `tenant_${tenantSlug.replace(/-/g, '_').toLowerCase()}`;
}

/**
 * Validates that a slug is safe to use as a PostgreSQL schema name.
 * Alphanumeric + hyphens only, 3-50 chars.
 */
export function validateTenantSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

/**
 * Generates the SET search_path SQL statement for a tenant schema.
 */
export function getSearchPathSql(tenantSlug: string): string {
  const schemaName = getTenantSchemaName(tenantSlug);
  return `SET search_path = "${schemaName}"`;
}
