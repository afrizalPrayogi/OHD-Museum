import { authenticateRequest } from '@/lib/rbac';
import { query } from '@/lib/db';
import { apiSuccess, apiUnauthorized, apiNotFound, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized('Sesi tidak valid atau telah kedaluwarsa');
    }

    const userResult = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, u.created_at, r.name as role_name, r.description as role_description
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [authUser.userId]
    );

    if (userResult.rows.length === 0) {
      return apiNotFound('Pengguna tidak ditemukan');
    }

    const user = userResult.rows[0];

    return apiSuccess(
      {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          isActive: user.is_active,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
          role: {
            name: user.role_name,
            description: user.role_description,
          },
          permissions: authUser.permissions,
        },
      },
      'Profil pengguna berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat profil pengguna', error);
  }
}
