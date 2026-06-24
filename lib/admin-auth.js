// lib/admin-auth.js — admin authentication & authorization (RBAC)
// Replaces the old shared-secret bearer token. Admins log in with username/password
// and receive a JWT (role:'admin_user'). Each admin route calls requireAdmin(request, perm).
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

export function getAdminTokenPayload(request) {
  const h = request.headers.get('authorization');
  if (!h) return null;
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    return d.role === 'admin_user' ? d : null;
  } catch {
    return null;
  }
}

// Validates the token AND re-checks the admin against the DB so suspensions and
// permission changes take effect immediately (not only at next login).
// `permission` is optional; super_admin bypasses all permission checks.
export async function requireAdmin(request, permission) {
  const tok = getAdminTokenPayload(request);
  if (!tok) return { ok: false, status: 401, error: 'Unauthorized' };

  let r;
  try {
    r = await pool.query('SELECT id, username, role, permissions, active FROM admins WHERE id = $1', [tok.adminId]);
  } catch {
    return { ok: false, status: 500, error: 'Auth check failed.' };
  }
  if (!r.rows.length) return { ok: false, status: 401, error: 'Unauthorized' };

  const a = r.rows[0];
  if (a.active === false) return { ok: false, status: 403, error: 'Your admin account has been suspended.' };

  const perms = Array.isArray(a.permissions) ? a.permissions : (a.permissions || []);
  if (permission && a.role !== 'super_admin' && !perms.includes(permission)) {
    return { ok: false, status: 403, error: 'You do not have permission for this action.' };
  }
  return { ok: true, admin: { adminId: a.id, username: a.username, role: a.role, permissions: perms } };
}

// Best-effort audit logging — never blocks the main action.
export async function logAdminAction(admin, action, detail) {
  try {
    await pool.query(
      'INSERT INTO admin_audit (admin_id, admin_username, action, detail) VALUES ($1,$2,$3,$4)',
      [admin?.adminId ?? null, admin?.username ?? null, action, detail ?? null]
    );
  } catch (e) {
    console.error('audit log failed', e);
  }
}
