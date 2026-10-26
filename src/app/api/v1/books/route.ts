import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { parsePaginationParams } from '@/utils/pagination';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const pagination = parsePaginationParams(request.url);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (b.title ILIKE $${params.length} OR b.author_editor ILIKE $${params.length} OR b.isbn ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM books b ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT * FROM books b
       ${whereClause}
       ORDER BY b.publish_year DESC NULLS LAST, b.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Katalog buku publikasi berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat katalog buku', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'books:create')) {
      return apiForbidden('Izin menambahkan buku tidak memadai');
    }

    const body = await request.json();
    const {
      title,
      author_editor,
      isbn,
      publish_year,
      synopsis,
      cover_image_url,
      sample_pdf_url,
      order_wa_link,
    } = body;

    if (!title || !cover_image_url) {
      return apiBadRequest('Judul buku dan sampul buku wajib diisi');
    }

    const result = await query(
      `INSERT INTO books (
        title,
        author_editor,
        isbn,
        publish_year,
        synopsis,
        cover_image_url,
        sample_pdf_url,
        order_wa_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        title,
        author_editor || null,
        isbn || null,
        publish_year || null,
        synopsis || null,
        cover_image_url,
        sample_pdf_url || null,
        order_wa_link || null,
      ]
    );

    const book = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'books',
      recordId: book.id,
      newValues: book,
      ipAddress,
      userAgent,
    });

    return apiCreated(book, 'Katalog buku berhasil ditambahkan');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('ISBN buku sudah terdaftar dalam sistem');
    }
    return apiError('Gagal menambahkan buku', error);
  }
}
