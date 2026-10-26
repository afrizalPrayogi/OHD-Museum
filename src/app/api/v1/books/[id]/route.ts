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
    const result = await query('SELECT * FROM books WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return apiNotFound('Buku tidak ditemukan');
    }
    return apiSuccess(result.rows[0], 'Detail buku berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat detail buku', error);
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
    if (!hasPermission(authUser, 'books:update')) {
      return apiForbidden('Izin mengubah buku tidak memadai');
    }

    const { id } = params;
    const body = await request.json();

    const currentResult = await query('SELECT * FROM books WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Buku tidak ditemukan');
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE books SET
        title = COALESCE($1, title),
        author_editor = COALESCE($2, author_editor),
        isbn = COALESCE($3, isbn),
        publish_year = COALESCE($4, publish_year),
        synopsis = COALESCE($5, synopsis),
        cover_image_url = COALESCE($6, cover_image_url),
        sample_pdf_url = COALESCE($7, sample_pdf_url),
        order_wa_link = COALESCE($8, order_wa_link)
       WHERE id = $9
       RETURNING *`,
      [
        body.title,
        body.author_editor,
        body.isbn,
        body.publish_year,
        body.synopsis,
        body.cover_image_url,
        body.sample_pdf_url,
        body.order_wa_link,
        id,
      ]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'books',
      recordId: id,
      oldValues: current,
      newValues: updated,
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Data buku berhasil diperbarui');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('ISBN buku sudah terdaftar');
    }
    return apiError('Gagal memperbarui buku', error);
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
    if (!hasPermission(authUser, 'books:delete')) {
      return apiForbidden('Izin menghapus buku tidak memadai');
    }

    const { id } = params;
    const currentResult = await query('SELECT * FROM books WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return apiNotFound('Buku tidak ditemukan');
    }

    await query('DELETE FROM books WHERE id = $1', [id]);

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'DELETE',
      entityName: 'books',
      recordId: id,
      oldValues: currentResult.rows[0],
      ipAddress,
      userAgent,
    });

    return apiSuccess({ deleted: true, id }, 'Buku berhasil dihapus dari katalog');
  } catch (error) {
    return apiError('Gagal menghapus buku', error);
  }
}
