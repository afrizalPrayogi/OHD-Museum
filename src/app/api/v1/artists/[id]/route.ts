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

    // Search by UUID or slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const sql = isUuid
      ? 'SELECT * FROM artists WHERE id = $1'
      : 'SELECT * FROM artists WHERE slug = $1';

    const artistResult = await query(sql, [id]);
    if (artistResult.rows.length === 0) {
      return apiNotFound('Seniman tidak ditemukan');
    }

    const artist = artistResult.rows[0];

    // Fetch related artworks by this artist
    const artworksResult = await query(
      `SELECT w.id, w.title, w.slug, w.creation_year, w.medium, w.dimensions, w.image_url, w.is_featured, c.name as category_name
       FROM artworks w
       LEFT JOIN categories c ON c.id = w.category_id
       WHERE w.artist_id = $1
       ORDER BY w.creation_year DESC NULLS LAST`,
      [artist.id]
    );

    return apiSuccess(
      {
        ...artist,
        artworks: artworksResult.rows,
      },
      'Detail seniman berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat detail seniman', error);
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
    if (!hasPermission(authUser, 'artists:update')) {
      return apiForbidden('Izin mengubah seniman tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM artists WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Seniman tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE artists SET
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        biography = COALESCE($3, biography),
        portrait_url = COALESCE($4, portrait_url),
        era_period = COALESCE($5, era_period),
        birth_year = COALESCE($6, birth_year),
        death_year = COALESCE($7, death_year),
        is_prominent = COALESCE($8, is_prominent),
        locale = COALESCE($9, locale)
       WHERE id = $10
       RETURNING *`,
      [
        body.name,
        body.slug ? body.slug.toLowerCase().trim() : null,
        body.biography,
        body.portrait_url,
        body.era_period,
        body.birth_year,
        body.death_year,
        body.is_prominent,
        body.locale,
        id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'artists',
      recordId: id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Data seniman berhasil diperbarui');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug seniman sudah digunakan');
    }
    return apiError('Gagal memperbarui seniman', error);
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
    if (!hasPermission(authUser, 'artists:delete')) {
      return apiForbidden('Izin menghapus seniman tidak memadai');
    }

    const { id } = params;
    const currentResult = await query('SELECT * FROM artists WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Seniman tidak ditemukan');
    }

    await query('DELETE FROM artists WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'artists',
      recordId: id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Data seniman berhasil dihapus');
  } catch (error: any) {
    if (error?.code === '23503') {
      return apiBadRequest('Seniman tidak dapat dihapus karena masih memiliki karya seni terkait');
    }
    return apiError('Gagal menghapus seniman', error);
  }
}
