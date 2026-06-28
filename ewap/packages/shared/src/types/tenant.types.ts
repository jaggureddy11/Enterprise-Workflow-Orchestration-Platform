// packages/shared/src/types/tenant.types.ts

export type TenantPlan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface Tenant {
  id: string;
  name: string;
  slug: string; // used as schema name
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  slackWebhook?: string;
  emailDomain?: string;
  maxWorkflows?: number;
  maxUsers?: number;
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
}

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  schemaName: string;
}

export interface RegisterTenantInput {
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerFirstName: string;
  ownerLastName: string;
}
