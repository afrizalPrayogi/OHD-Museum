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
      ? 'SELECT * FROM exhibitions WHERE id = $1'
      : 'SELECT * FROM exhibitions WHERE slug = $1';

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return apiNotFound('Pameran tidak ditemukan');
    }

    const exhibition = result.rows[0];

    // Fetch artworks in this exhibition
    const artworksResult = await query(
      `SELECT 
        w.id,
        w.title,
        w.slug,
        w.creation_year,
        w.medium,
        w.dimensions,
        w.image_url,
        a.name as artist_name,
        ea.sort_order
       FROM exhibition_artworks ea
       JOIN artworks w ON w.id = ea.artwork_id
       JOIN artists a ON a.id = w.artist_id
       WHERE ea.exhibition_id = $1
       ORDER BY ea.sort_order ASC`,
      [exhibition.id]
    );

    return apiSuccess(
      {
        ...exhibition,
        artworks: artworksResult.rows,
      },
      'Detail pameran berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat detail pameran', error);
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
    if (!hasPermission(authUser, 'exhibitions:update')) {
      return apiForbidden('Izin mengubah pameran tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM exhibitions WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Pameran tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE exhibitions SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        curator_name = COALESCE($3, curator_name),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        status = COALESCE($6, status),
        cover_image_url = COALESCE($7, cover_image_url),
        essay = COALESCE($8, essay),
        venue_room = COALESCE($9, venue_room),
        locale = COALESCE($10, locale)
       WHERE id = $11
       RETURNING *`,
      [
        body.title,
        body.slug ? body.slug.toLowerCase().trim() : null,
        body.curator_name,
        body.start_date,
        body.end_date,
        body.status,
        body.cover_image_url,
        body.essay ? JSON.stringify(body.essay) : null,
        body.venue_room,
        body.locale,
        id,
      ]
    );

    const updated = result.rows[0];

    // Sync artwork_ids if provided
    if (Array.isArray(body.artwork_ids)) {
      await query('DELETE FROM exhibition_artworks WHERE exhibition_id = $1', [id]);
      for (let i = 0; i < body.artwork_ids.length; i++) {
        await query(
          `INSERT INTO exhibition_artworks (exhibition_id, artwork_id, sort_order)
           VALUES ($1, $2, $3)`,
          [id, body.artwork_ids[i], i + 1]
        );
      }
    }

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'exhibitions',
      recordId: id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Data pameran berhasil diperbarui');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug pameran sudah digunakan');
    }
    return apiError('Gagal memperbarui pameran', error);
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
    if (!hasPermission(authUser, 'exhibitions:delete')) {
      return apiForbidden('Izin menghapus pameran tidak memadai');
    }

    const { id } = params;
    const currentResult = await query('SELECT * FROM exhibitions WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Pameran tidak ditemukan');
    }

    await query('DELETE FROM exhibitions WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'exhibitions',
      recordId: id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Pameran berhasil dihapus');
  } catch (error) {
    return apiError('Gagal menghapus pameran', error);
  }
}
