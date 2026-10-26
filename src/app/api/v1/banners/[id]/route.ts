import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiNotFound, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'banners:update')) {
      return apiForbidden('Izin mengubah banner tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM banners WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Banner tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE banners SET
        title = COALESCE($1, title),
        subtitle = COALESCE($2, subtitle),
        desktop_image_url = COALESCE($3, desktop_image_url),
        mobile_image_url = COALESCE($4, mobile_image_url),
        cta_text = COALESCE($5, cta_text),
        cta_url = COALESCE($6, cta_url),
        sort_order = COALESCE($7, sort_order),
        is_active = COALESCE($8, is_active)
       WHERE id = $9
       RETURNING *`,
      [
        body.title,
        body.subtitle,
        body.desktop_image_url,
        body.mobile_image_url,
        body.cta_text,
        body.cta_url,
        body.sort_order,
        body.is_active,
        id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'banners',
      recordId: id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Banner berhasil diperbarui');
  } catch (error) {
    return apiError('Gagal memperbarui banner', error);
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
    if (!hasPermission(authUser, 'banners:delete')) {
      return apiForbidden('Izin menghapus banner tidak memadai');
    }

    const { id } = params;
    const currentResult = await query('SELECT * FROM banners WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Banner tidak ditemukan');
    }

    await query('DELETE FROM banners WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'banners',
      recordId: id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Banner berhasil dihapus');
  } catch (error) {
    return apiError('Gagal menghapus banner', error);
  }
}
