import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authUser = await authenticateRequest(request);
    const isCmsUser = authUser && hasPermission(authUser, 'banners:read');

    let sql = 'SELECT * FROM banners';
    const params: any[] = [];

    if (!isCmsUser) {
      sql += ' WHERE is_active = true';
    } else if (searchParams.get('is_active')) {
      params.push(searchParams.get('is_active') === 'true');
      sql += ` WHERE is_active = $${params.length}`;
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const result = await query(sql, params);
    return apiSuccess(result.rows, 'Daftar banner hero berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat banner hero', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'banners:create')) {
      return apiForbidden('Izin membuat banner tidak memadai');
    }

    const body = await request.json();
    const {
      title,
      subtitle,
      desktop_image_url,
      mobile_image_url,
      cta_text,
      cta_url,
      sort_order,
      is_active,
    } = body;

    if (!title || !desktop_image_url) {
      return apiBadRequest('Judul banner dan tautan gambar desktop wajib diisi');
    }

    const result = await query(
      `INSERT INTO banners (
        title,
        subtitle,
        desktop_image_url,
        mobile_image_url,
        cta_text,
        cta_url,
        sort_order,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        title,
        subtitle || null,
        desktop_image_url,
        mobile_image_url || null,
        cta_text || null,
        cta_url || null,
        sort_order || 0,
        is_active ?? true,
      ]
    );

    const banner = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'banners',
      recordId: banner.id,
      newValues: banner,
      ipAddress,
      userAgent,
    });

    return apiCreated(banner, 'Banner hero berhasil dibuat');
  } catch (error) {
    return apiError('Gagal membuat banner', error);
  }
}
