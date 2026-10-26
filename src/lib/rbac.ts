import { verifyJwt, TokenPayload } from './auth';
import { query } from './db';

export interface AuthenticatedUser extends TokenPayload {
  permissions: string[];
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = verifyJwt(token);
  if (!payload) {
    return null;
  }

  // Fetch permissions for this user role
  try {
    const permResult = await query<{ code: string }>(
      `SELECT p.code 
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [payload.roleId]
    );

    const permissions = permResult.rows.map((row: { code: string }) => row.code);

    return {
      ...payload,
      permissions,
    };
  } catch (error) {
    console.error('RBAC permission check error:', error);
    return null;
  }
}

export function hasPermission(user: AuthenticatedUser, requiredPermission: string): boolean {
  if (user.roleName === 'super_admin') {
    return true;
  }
  return user.permissions.includes(requiredPermission);
}
