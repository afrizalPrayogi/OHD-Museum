import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { apiSuccess, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'roles:read') && authUser.roleName !== 'super_admin') {
      return apiForbidden('Izin melihat peran sistem tidak memadai');
    }

    const rolesResult = await query<RoleRow>('SELECT * FROM roles ORDER BY name ASC');

    const rolesWithPermissions = await Promise.all(
      rolesResult.rows.map(async (role: RoleRow) => {
        const permsResult = await query(
          `SELECT p.id, p.code, p.module, p.description
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = $1
           ORDER BY p.module ASC, p.code ASC`,
          [role.id]
        );
        return {
          ...role,
          permissions: permsResult.rows,
        };
      })
    );

    return apiSuccess(rolesWithPermissions, 'Daftar peran sistem dan hak akses berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat peran sistem', error);
  }
}
