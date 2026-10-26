import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiNotFound, apiUnauthorized, apiForbidden, apiBadRequest, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const sql = isUuid
      ? 'SELECT * FROM reservations WHERE id = $1'
      : 'SELECT * FROM reservations WHERE booking_code = $1';

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return apiNotFound('Data reservasi tidak ditemukan');
    }

    return apiSuccess(result.rows[0], 'Detail reservasi berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat detail reservasi', error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'reservations:update')) {
      return apiForbidden('Izin mengubah status reservasi tidak memadai');
    }

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!status || !allowedStatuses.includes(status)) {
      return apiBadRequest('Status tidak valid. Pilihan: pending, confirmed, cancelled, completed');
    }

    const currentResult = await query('SELECT * FROM reservations WHERE id = $1 OR booking_code = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Data reservasi tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      'UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, current.id]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'reservations',
      recordId: current.id,
      oldValues: { status: current.status },
      newValues: { status: updated.status },
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Status reservasi berhasil diperbarui');
  } catch (error) {
    return apiError('Gagal memperbarui status reservasi', error);
  }
}
