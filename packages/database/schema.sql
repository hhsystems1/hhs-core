-- HHS-CORE UNIFIED DATABASE SCHEMA
-- Version: 1.0.0
-- Hierarchy: Root (HHS) -> Tenant (Client) -> Sub-Account (Distributor/Partner)

-- 1. TENANCY CORE
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    parent_tenant_id UUID REFERENCES tenants(id), -- Self-referencing for nested hierarchy
    account_level TEXT CHECK (account_level IN ('root', 'tenant', 'sub_account')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MEMBERSHIP & AUTH
CREATE TABLE tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL, -- 'admin', 'manager', 'staff', 'viewer'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CRM CORE (Combined from CRM2.1)
CREATE TABLE crm_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES crm_accounts(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AGENT ORCHESTRATION (Combined from Mission Control)
CREATE TABLE agent_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    capability TEXT NOT NULL,
    status TEXT CHECK (status IN ('queued', 'running', 'needs_approval', 'completed', 'failed')) DEFAULT 'queued',
    approval_required BOOLEAN DEFAULT false,
    input JSONB,
    result JSONB,
    artifacts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES agent_jobs(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    action TEXT NOT NULL,
    output TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. EVENT BUS
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB,
    actor_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
