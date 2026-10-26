import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { parsePaginationParams } from '@/utils/pagination';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(request.url);
    const status = searchParams.get('status'); // 'current', 'upcoming', 'past'

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND e.status = $${params.length}`;
    }

    if (pagination.locale) {
      params.push(pagination.locale);
      whereClause += ` AND e.locale = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (e.title ILIKE $${params.length} OR e.curator_name ILIKE $${params.length})`;
    }

    // Count
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM exhibitions e ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    // Data with artworks count
    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT 
        e.*,
        (SELECT COUNT(*)::int FROM exhibition_artworks ea WHERE ea.exhibition_id = e.id) as artworks_count
       FROM exhibitions e
       ${whereClause}
       ORDER BY 
        CASE 
          WHEN e.status = 'current' THEN 1
          WHEN e.status = 'upcoming' THEN 2
          ELSE 3
        END,
        e.start_date DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Agenda pameran berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat agenda pameran', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'exhibitions:create')) {
      return apiForbidden('Izin membuat pameran tidak memadai');
    }

    const body = await request.json();
    const {
      title,
      slug,
      curator_name,
      start_date,
      end_date,
      status,
      cover_image_url,
      essay,
      venue_room,
      locale,
      artwork_ids,
    } = body;

    if (!title || !slug || !start_date || !end_date || !cover_image_url) {
      return apiBadRequest('Judul, slug, tanggal mulai, tanggal selesai, dan sampul wajib diisi');
    }

    // Insert exhibition
    const result = await query(
      `INSERT INTO exhibitions (
        title,
        slug,
        curator_name,
        start_date,
        end_date,
        status,
        cover_image_url,
        essay,
        venue_room,
        locale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        title,
        slug.toLowerCase().trim(),
        curator_name || null,
        start_date,
        end_date,
        status || 'upcoming',
        cover_image_url,
        essay ? JSON.stringify(essay) : null,
        venue_room || 'Main Gallery',
        locale || 'id',
      ]
    );

    const exhibition = result.rows[0];

    // Link artworks if provided
    if (Array.isArray(artwork_ids) && artwork_ids.length > 0) {
      for (let i = 0; i < artwork_ids.length; i++) {
        await query(
          `INSERT INTO exhibition_artworks (exhibition_id, artwork_id, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [exhibition.id, artwork_ids[i], i + 1]
        );
      }
    }

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'exhibitions',
      recordId: exhibition.id,
      newValues: exhibition,
      ipAddress,
      userAgent,
    });

    return apiCreated(exhibition, 'Agenda pameran berhasil ditambahkan');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug pameran sudah digunakan');
    }
    return apiError('Gagal menambahkan pameran', error);
  }
}
