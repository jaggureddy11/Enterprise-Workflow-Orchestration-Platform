export function getTenantSchemaName(tenantSlug) {
    return `tenant_${tenantSlug.replace(/-/g, '_').toLowerCase()}`;
}
export function validateTenantSlug(slug) {
    return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}
export function getSearchPathSql(tenantSlug) {
    const schemaName = getTenantSchemaName(tenantSlug);
    return `SET search_path = "${schemaName}"`;
}
//# sourceMappingURL=tenant.util.js.map