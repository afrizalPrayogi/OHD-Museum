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
        a.*,
        u.full_name as author_name,
        c.name as category_name,
        c.slug as category_slug
      FROM articles a
      JOIN users u ON u.id = a.author_id
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE ${isUuid ? 'a.id = $1' : 'a.slug = $1'}
    `;

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return apiNotFound('Artikel tidak ditemukan');
    }

    const article = result.rows[0];

    // Check publication guard for public
    if (article.status !== 'published') {
      const authUser = await authenticateRequest(request);
      if (!authUser || !hasPermission(authUser, 'articles:read')) {
        return apiNotFound('Artikel tidak ditemukan atau masih berstatus draf');
      }
    }

    return apiSuccess(article, 'Detail artikel berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat detail artikel', error);
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
    if (!hasPermission(authUser, 'articles:update')) {
      return apiForbidden('Izin mengubah artikel tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM articles WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Artikel tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE articles SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        category_id = COALESCE($3, category_id),
        excerpt = COALESCE($4, excerpt),
        content = COALESCE($5, content),
        cover_image_url = COALESCE($6, cover_image_url),
        status = COALESCE($7, status),
        locale = COALESCE($8, locale),
        published_at = COALESCE($9, published_at)
       WHERE id = $10
       RETURNING *`,
      [
        body.title,
        body.slug ? body.slug.toLowerCase().trim() : null,
        body.category_id,
        body.excerpt,
        body.content ? (typeof body.content === 'string' ? JSON.stringify({ body: body.content }) : JSON.stringify(body.content)) : null,
        body.cover_image_url,
        body.status,
        body.locale,
        body.published_at,
        id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'articles',
      recordId: id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Artikel berhasil diperbarui');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug artikel sudah digunakan');
    }
    return apiError('Gagal memperbarui artikel', error);
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
    if (!hasPermission(authUser, 'articles:delete')) {
      return apiForbidden('Izin menghapus artikel tidak memadai');
    }

    const { id } = params;
    const currentResult = await query('SELECT * FROM articles WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Artikel tidak ditemukan');
    }

    await query('DELETE FROM articles WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'articles',
      recordId: id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Artikel berhasil dihapus');
  } catch (error) {
    return apiError('Gagal menghapus artikel', error);
  }
}
