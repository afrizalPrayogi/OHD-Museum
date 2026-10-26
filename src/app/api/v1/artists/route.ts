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
    const isProminent = searchParams.get('is_prominent');
    const era = searchParams.get('era');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (isProminent !== null && isProminent !== undefined) {
      params.push(isProminent === 'true');
      whereClause += ` AND a.is_prominent = $${params.length}`;
    }

    if (era) {
      params.push(era);
      whereClause += ` AND a.era_period ILIKE $${params.length}`;
    }

    if (pagination.locale) {
      params.push(pagination.locale);
      whereClause += ` AND a.locale = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (a.name ILIKE $${params.length} OR a.biography ILIKE $${params.length})`;
    }

    // Count query
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM artists a ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    // Data query with artwork counts
    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT a.*, 
        (SELECT COUNT(*)::int FROM artworks w WHERE w.artist_id = a.id) as artworks_count
       FROM artists a
       ${whereClause}
       ORDER BY a.is_prominent DESC, a.name ASC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Daftar seniman berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat seniman', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'artists:create')) {
      return apiForbidden('Izin menambahkan seniman tidak memadai');
    }

    const body = await request.json();
    const {
      name,
      slug,
      biography,
      portrait_url,
      era_period,
      birth_year,
      death_year,
      is_prominent,
      locale,
    } = body;

    if (!name || !slug) {
      return apiBadRequest('Nama seniman dan slug wajib diisi');
    }

    const result = await query(
      `INSERT INTO artists (
        name,
        slug,
        biography,
        portrait_url,
        era_period,
        birth_year,
        death_year,
        is_prominent,
        locale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        name,
        slug.toLowerCase().trim(),
        biography || null,
        portrait_url || null,
        era_period || null,
        birth_year || null,
        death_year || null,
        is_prominent || false,
        locale || 'id',
      ]
    );

    const artist = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'artists',
      recordId: artist.id,
      newValues: artist,
      ipAddress,
      userAgent,
    });

    return apiCreated(artist, 'Data maestro seniman berhasil ditambahkan');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug seniman sudah digunakan');
    }
    return apiError('Gagal menambahkan seniman', error);
  }
}
