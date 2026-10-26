import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiNotFound, apiUnauthorized, apiForbidden, apiBadRequest, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'id';

    const result = await query(
      'SELECT * FROM pages WHERE (slug = $1 OR id::text = $1) AND (locale = $2 OR locale IS NULL) LIMIT 1',
      [slug, locale]
    );

    if (result.rows.length === 0) {
      // Fallback query without locale
      const fallbackResult = await query(
        'SELECT * FROM pages WHERE slug = $1 OR id::text = $1 LIMIT 1',
        [slug]
      );
      if (fallbackResult.rows.length === 0) {
        return apiNotFound('Halaman tidak ditemukan');
      }
      return apiSuccess(fallbackResult.rows[0], 'Halaman berhasil dimuat');
    }

    return apiSuccess(result.rows[0], 'Halaman berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat halaman', error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'pages:update')) {
      return apiForbidden('Izin mengubah halaman tidak memadai');
    }

    const { slug } = params;
    const body = await request.json();

    const currentResult = await query(
      'SELECT * FROM pages WHERE slug = $1 OR id::text = $1 LIMIT 1',
      [slug]
    );
    if (currentResult.rows.length === 0) {
      return apiNotFound('Halaman tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE pages SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        template_type = COALESCE($3, template_type),
        meta_title = COALESCE($4, meta_title),
        meta_description = COALESCE($5, meta_description),
        is_published = COALESCE($6, is_published),
        locale = COALESCE($7, locale)
       WHERE id = $8
       RETURNING *`,
      [
        body.title,
        body.content ? (typeof body.content === 'string' ? JSON.stringify({ body: body.content }) : JSON.stringify(body.content)) : null,
        body.template_type,
        body.meta_title,
        body.meta_description,
        body.is_published,
        body.locale,
        current.id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'pages',
      recordId: current.id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Halaman berhasil diperbarui');
  } catch (error) {
    return apiError('Gagal memperbarui halaman', error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'pages:delete')) {
      return apiForbidden('Izin menghapus halaman tidak memadai');
    }

    const { slug } = params;
    const currentResult = await query(
      'SELECT * FROM pages WHERE slug = $1 OR id::text = $1 LIMIT 1',
      [slug]
    );
    if (currentResult.rows.length === 0) {
      return apiNotFound('Halaman tidak ditemukan');
    }

    await query('DELETE FROM pages WHERE id = $1', [currentResult.rows[0].id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'pages',
      recordId: currentResult.rows[0].id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true }, 'Halaman berhasil dihapus');
  } catch (error) {
    return apiError('Gagal menghapus halaman', error);
  }
}
