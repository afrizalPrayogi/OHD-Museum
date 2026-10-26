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

    const sql = `
      SELECT 
        w.*,
        a.name as artist_name,
        a.biography as artist_biography,
        a.portrait_url as artist_portrait_url,
        a.era_period as artist_era,
        a.birth_year as artist_birth_year,
        a.death_year as artist_death_year,
        c.name as category_name
      FROM artworks w
      JOIN artists a ON a.id = w.artist_id
      LEFT JOIN categories c ON c.id = w.category_id
      WHERE ${isUuid ? 'w.id = $1' : 'w.slug = $1'}
    `;

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return apiNotFound('Karya seni tidak ditemukan');
    }

    const artwork = result.rows[0];

    // Fetch related exhibitions featuring this artwork
    const exhibitionsResult = await query(
      `SELECT e.id, e.title, e.slug, e.start_date, e.end_date, e.status, e.cover_image_url
       FROM exhibitions e
       JOIN exhibition_artworks ea ON ea.exhibition_id = e.id
       WHERE ea.artwork_id = $1
       ORDER BY e.start_date DESC`,
      [artwork.id]
    );

    return apiSuccess(
      {
        ...artwork,
        exhibitions: exhibitionsResult.rows,
      },
      'Detail karya seni berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat detail karya seni', error);
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
    if (!hasPermission(authUser, 'artworks:update')) {
      return apiForbidden('Izin mengubah karya seni tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Karya seni tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE artworks SET
        artist_id = COALESCE($1, artist_id),
        category_id = COALESCE($2, category_id),
        title = COALESCE($3, title),
        slug = COALESCE($4, slug),
        creation_year = COALESCE($5, creation_year),
        medium = COALESCE($6, medium),
        dimensions = COALESCE($7, dimensions),
        description = COALESCE($8, description),
        image_url = COALESCE($9, image_url),
        is_featured = COALESCE($10, is_featured),
        exhibition_status = COALESCE($11, exhibition_status),
        locale = COALESCE($12, locale)
       WHERE id = $13
       RETURNING *`,
      [
        body.artist_id,
        body.category_id,
        body.title,
        body.slug ? body.slug.toLowerCase().trim() : null,
        body.creation_year,
        body.medium,
        body.dimensions,
        body.description,
        body.image_url,
        body.is_featured,
        body.exhibition_status,
        body.locale,
        id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'artworks',
      recordId: id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Karya seni berhasil diperbarui');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug karya seni sudah digunakan');
    }
    return apiError('Gagal memperbarui karya seni', error);
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
    if (!hasPermission(authUser, 'artworks:delete')) {
      return apiForbidden('Izin menghapus karya seni tidak memadai');
    }

    const { id } = params;
    const currentResult = await query('SELECT * FROM artworks WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Karya seni tidak ditemukan');
    }

    await query('DELETE FROM artworks WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'artworks',
      recordId: id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Karya seni berhasil dihapus dari inventaris');
  } catch (error) {
    return apiError('Gagal menghapus karya seni', error);
  }
}
