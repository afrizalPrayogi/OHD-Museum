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
    const authUser = await authenticateRequest(request);
    const canViewAll = authUser && hasPermission(authUser, 'articles:read');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filter status
    if (canViewAll && pagination.status) {
      params.push(pagination.status);
      whereClause += ` AND a.status = $${params.length}`;
    } else if (!canViewAll) {
      // Public only sees published articles
      whereClause += ` AND a.status = 'published' AND (a.published_at <= NOW() OR a.published_at IS NULL)`;
    }

    if (pagination.category) {
      params.push(pagination.category);
      whereClause += ` AND (c.slug = $${params.length} OR c.id::text = $${params.length})`;
    }

    if (pagination.locale) {
      params.push(pagination.locale);
      whereClause += ` AND a.locale = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length} OR a.excerpt ILIKE $${params.length})`;
    }

    // Count
    const countResult = await query(
      `SELECT COUNT(*)::int as total 
       FROM articles a
       LEFT JOIN categories c ON c.id = a.category_id
       ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    // Data query
    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT 
        a.id,
        a.title,
        a.slug,
        a.excerpt,
        a.cover_image_url,
        a.status,
        a.locale,
        a.published_at,
        a.created_at,
        a.updated_at,
        u.id as author_id,
        u.full_name as author_name,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN categories c ON c.id = a.category_id
       ${whereClause}
       ORDER BY COALESCE(a.published_at, a.created_at) DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Daftar artikel publikasi berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat artikel', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'articles:create')) {
      return apiForbidden('Izin membuat artikel tidak memadai');
    }

    const body = await request.json();
    const {
      title,
      slug,
      category_id,
      excerpt,
      content,
      cover_image_url,
      status,
      locale,
      published_at,
    } = body;

    if (!title || !slug || !content) {
      return apiBadRequest('Judul, slug, dan isi konten artikel wajib diisi');
    }

    const isPublished = status === 'published';
    const finalPublishedAt = isPublished
      ? published_at || new Date().toISOString()
      : published_at || null;

    const result = await query(
      `INSERT INTO articles (
        author_id,
        category_id,
        title,
        slug,
        excerpt,
        content,
        cover_image_url,
        status,
        locale,
        published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        authUser.userId,
        category_id || null,
        title,
        slug.toLowerCase().trim(),
        excerpt || null,
        typeof content === 'string' ? JSON.stringify({ body: content }) : JSON.stringify(content),
        cover_image_url || null,
        status || 'draft',
        locale || 'id',
        finalPublishedAt,
      ]
    );

    const article = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'articles',
      recordId: article.id,
      newValues: article,
      ipAddress,
      userAgent,
    });

    return apiCreated(article, 'Artikel berhasil dibuat');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug artikel sudah digunakan');
    }
    return apiError('Gagal membuat artikel', error);
  }
}
