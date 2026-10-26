import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale');
    const authUser = await authenticateRequest(request);
    const isCmsUser = authUser && hasPermission(authUser, 'pages:read');

    let sql = 'SELECT id, slug, title, template_type, meta_title, meta_description, is_published, locale, created_at, updated_at FROM pages';
    const params: any[] = [];

    if (!isCmsUser) {
      sql += ' WHERE is_published = true';
    } else {
      sql += ' WHERE 1=1';
    }

    if (locale) {
      params.push(locale);
      sql += ` AND locale = $${params.length}`;
    }

    sql += ' ORDER BY title ASC';

    const result = await query(sql, params);
    return apiSuccess(result.rows, 'Daftar halaman statis berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat daftar halaman', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'pages:create')) {
      return apiForbidden('Izin membuat halaman tidak memadai');
    }

    const body = await request.json();
    const {
      slug,
      title,
      content,
      template_type,
      meta_title,
      meta_description,
      is_published,
      locale,
    } = body;

    if (!slug || !title || !content) {
      return apiBadRequest('Slug, judul, dan konten halaman wajib diisi');
    }

    const result = await query(
      `INSERT INTO pages (
        slug,
        title,
        content,
        template_type,
        meta_title,
        meta_description,
        is_published,
        locale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        slug.toLowerCase().trim(),
        title,
        typeof content === 'string' ? JSON.stringify({ body: content }) : JSON.stringify(content),
        template_type || 'standard',
        meta_title || title,
        meta_description || null,
        is_published ?? true,
        locale || 'id',
      ]
    );

    const page = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'pages',
      recordId: page.id,
      newValues: page,
      ipAddress,
      userAgent,
    });

    return apiCreated(page, 'Halaman berhasil dibuat');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug halaman sudah digunakan');
    }
    return apiError('Gagal membuat halaman', error);
  }
}
