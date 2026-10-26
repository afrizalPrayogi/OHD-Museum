import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiNotFound, apiUnauthorized, apiForbidden, apiBadRequest, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }

    const { id } = params;
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, u.created_at, u.updated_at, r.id as role_id, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return apiNotFound('Pengguna tidak ditemukan');
    }

    return apiSuccess(result.rows[0], 'Detail pengguna berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat pengguna', error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'users:update') && authUser.roleName !== 'super_admin') {
      return apiForbidden('Izin memperbarui pengguna tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Pengguna tidak ditemukan');
    }
    const current = currentResult.rows[0];

    let passwordHash = current.password_hash;
    if (body.password && body.password.length >= 8) {
      passwordHash = await hashPassword(body.password);
    }

    const result = await query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        is_active = COALESCE($4, is_active),
        role_id = COALESCE($5, role_id),
        password_hash = $6,
        updated_at = NOW()
       WHERE id = $7
       RETURNING id, full_name, email, phone, is_active, role_id, updated_at`,
      [
        body.full_name,
        body.email ? body.email.toLowerCase().trim() : null,
        body.phone,
        body.is_active,
        body.role_id,
        passwordHash,
        id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'users',
      recordId: id,
      oldValues: { full_name: current.full_name, email: current.email, is_active: current.is_active },
      newValues: { full_name: updated.full_name, email: updated.email, is_active: updated.is_active },
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Data pengguna berhasil diperbarui');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Alamat email sudah terdaftar');
    }
    return apiError('Gagal memperbarui pengguna', error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'users:delete') && authUser.roleName !== 'super_admin') {
      return apiForbidden('Izin menghapus pengguna tidak memadai');
    }

    const { id } = params;

    // Prevent self-deletion
    if (id === authUser.userId) {
      return apiBadRequest('Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif');
    }

    const currentResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Pengguna tidak ditemukan');
    }

    await query('DELETE FROM users WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'users',
      recordId: id,
      oldValues: { id, email: currentResult.rows[0].email },
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Pengguna berhasil dihapus');
  } catch (error) {
    return apiError('Gagal menghapus pengguna', error);
  }
}
