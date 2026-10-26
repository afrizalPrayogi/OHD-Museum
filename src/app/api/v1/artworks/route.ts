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
    const isFeatured = searchParams.get('is_featured');
    const artistId = searchParams.get('artist_id');
    const categoryId = searchParams.get('category_id');
    const medium = searchParams.get('medium');
    const exhibitionStatus = searchParams.get('exhibition_status');
    const yearFrom = searchParams.get('year_from');
    const yearTo = searchParams.get('year_to');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (isFeatured !== null && isFeatured !== undefined) {
      params.push(isFeatured === 'true');
      whereClause += ` AND w.is_featured = $${params.length}`;
    }

    if (artistId) {
      params.push(artistId);
      whereClause += ` AND w.artist_id = $${params.length}`;
    }

    if (categoryId) {
      params.push(categoryId);
      whereClause += ` AND w.category_id = $${params.length}`;
    }

    if (medium) {
      params.push(`%${medium}%`);
      whereClause += ` AND w.medium ILIKE $${params.length}`;
    }

    if (exhibitionStatus) {
      params.push(exhibitionStatus);
      whereClause += ` AND w.exhibition_status = $${params.length}`;
    }

    if (yearFrom) {
      params.push(parseInt(yearFrom, 10));
      whereClause += ` AND w.creation_year >= $${params.length}`;
    }

    if (yearTo) {
      params.push(parseInt(yearTo, 10));
      whereClause += ` AND w.creation_year <= $${params.length}`;
    }

    if (pagination.locale) {
      params.push(pagination.locale);
      whereClause += ` AND w.locale = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (w.title ILIKE $${params.length} OR a.name ILIKE $${params.length} OR w.medium ILIKE $${params.length})`;
    }

    // Count query
    const countResult = await query(
      `SELECT COUNT(*)::int as total 
       FROM artworks w
       JOIN artists a ON a.id = w.artist_id
       ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    // Data query with artist and category details
    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT 
        w.id,
        w.title,
        w.slug,
        w.creation_year,
        w.medium,
        w.dimensions,
        w.description,
        w.image_url,
        w.is_featured,
        w.exhibition_status,
        w.locale,
        w.created_at,
        w.updated_at,
        a.id as artist_id,
        a.name as artist_name,
        a.era_period as artist_era,
        c.id as category_id,
        c.name as category_name
       FROM artworks w
       JOIN artists a ON a.id = w.artist_id
       LEFT JOIN categories c ON c.id = w.category_id
       ${whereClause}
       ORDER BY w.is_featured DESC, w.creation_year DESC NULLS LAST, w.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Koleksi karya seni berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat daftar karya seni', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'artworks:create')) {
      return apiForbidden('Izin menambahkan karya seni tidak memadai');
    }

    const body = await request.json();
    const {
      artist_id,
      category_id,
      title,
      slug,
      creation_year,
      medium,
      dimensions,
      description,
      image_url,
      is_featured,
      exhibition_status,
      locale,
    } = body;

    if (!artist_id || !title || !slug || !image_url) {
      return apiBadRequest('Seniman, judul karya, slug, dan tautan gambar wajib diisi');
    }

    const result = await query(
      `INSERT INTO artworks (
        artist_id,
        category_id,
        title,
        slug,
        creation_year,
        medium,
        dimensions,
        description,
        image_url,
        is_featured,
        exhibition_status,
        locale
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        artist_id,
        category_id || null,
        title,
        slug.toLowerCase().trim(),
        creation_year || null,
        medium || null,
        dimensions || null,
        description || null,
        image_url,
        is_featured || false,
        exhibition_status || 'on_display',
        locale || 'id',
      ]
    );

    const artwork = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'artworks',
      recordId: artwork.id,
      newValues: artwork,
      ipAddress,
      userAgent,
    });

    return apiCreated(artwork, 'Karya seni berhasil ditambahkan ke inventaris');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug karya seni sudah digunakan');
    }
    if (error?.code === '23503') {
      return apiBadRequest('Seniman atau kategori yang dipilih tidak valid');
    }
    return apiError('Gagal menambahkan karya seni', error);
  }
}
