import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiNotFound, apiUnauthorized, apiForbidden, apiBadRequest, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'contact:update')) {
      return apiForbidden('Izin memperbarui pesan kontak tidak memadai');
    }

    const { id } = params;
    const body = await request.json();
    const { status, notes } = body;

    const allowedStatuses = ['unread', 'read', 'replied', 'archived'];
    if (status && !allowedStatuses.includes(status)) {
      return apiBadRequest('Status tidak valid. Pilihan: unread, read, replied, archived');
    }

    const currentResult = await query('SELECT * FROM contact_inquiries WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Pesan kontak tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE contact_inquiries SET
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes, id]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'contact_inquiries',
      recordId: id,
      oldValues: { status: current.status, notes: current.notes },
      newValues: { status: updated.status, notes: updated.notes },
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Pesan kontak berhasil diperbarui');
  } catch (error) {
    return apiError('Gagal memperbarui pesan kontak', error);
  }
}
