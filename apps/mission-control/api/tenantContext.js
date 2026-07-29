export const DEFAULT_TENANT_SLUG = 'helping-hands-systems';

export function clampLimit(value, { defaultValue = 50, min = 1, max = 200 } = {}) {
  const parsed = Number(value || defaultValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function getDefaultTenant(pool) {
  const result = await pool.query(
    `select id::text, name, slug, status
     from tenants
     where slug = $1
     limit 1`,
    [DEFAULT_TENANT_SLUG]
  );
  return result.rows[0] || null;
}

export function requireTenantContext(pool) {
  return async function tenantContextMiddleware(req, res, next) {
    try {
      const tenant = await getDefaultTenant(pool);
      if (!tenant) {
        return res.status(503).json({
          ok: false,
          error: 'default tenant not initialized',
          code: 'tenant_not_initialized',
        });
      }

      const membership = await pool.query(
        `select role, status
         from tenant_memberships
         where tenant_id = $1
           and user_id = $2
           and status = 'active'
         limit 1`,
        [tenant.id, req.session?.userId]
      );

      if (!membership.rows.length) {
        return res.status(403).json({
          ok: false,
          error: 'tenant membership required',
          code: 'tenant_membership_required',
        });
      }

      req.tenant = tenant;
      req.tenantMembership = membership.rows[0];
      next();
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'tenant_context_failed' });
    }
  };
}
