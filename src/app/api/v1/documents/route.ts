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
    const isCmsUser = authUser && hasPermission(authUser, 'documents:read');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (!isCmsUser) {
      whereClause += ' AND d.is_public = true';
    } else if (searchParams.get('is_public')) {
      params.push(searchParams.get('is_public') === 'true');
      whereClause += ` AND d.is_public = $${params.length}`;
    }

    if (pagination.category) {
      params.push(pagination.category);
      whereClause += ` AND (c.slug = $${params.length} OR c.id::text = $${params.length})`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (d.title ILIKE $${params.length} OR d.file_type ILIKE $${params.length})`;
    }

    // Count
    const countResult = await query(
      `SELECT COUNT(*)::int as total 
       FROM documents d
       LEFT JOIN categories c ON c.id = d.category_id
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
        d.*,
        c.name as category_name,
        c.slug as category_slug,
        u.full_name as uploader_name
       FROM documents d
       LEFT JOIN categories c ON c.id = d.category_id
       LEFT JOIN users u ON u.id = d.uploaded_by
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Media dan dokumen berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat dokumen', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'documents:create')) {
      return apiForbidden('Izin mengunggah dokumen tidak memadai');
    }

    const body = await request.json();
    const { title, category_id, file_url, file_type, file_size_kb, is_public } = body;

    if (!title || !file_url || !file_type) {
      return apiBadRequest('Judul, tautan file, dan tipe file wajib diisi');
    }

    const result = await query(
      `INSERT INTO documents (
        category_id,
        uploaded_by,
        title,
        file_url,
        file_type,
        file_size_kb,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        category_id || null,
        authUser.userId,
        title,
        file_url,
        file_type.toLowerCase().trim(),
        file_size_kb || 0,
        is_public ?? true,
      ]
    );

    const doc = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'documents',
      recordId: doc.id,
      newValues: doc,
      ipAddress,
      userAgent,
    });

    return apiCreated(doc, 'Dokumen berhasil ditambahkan');
  } catch (error) {
    return apiError('Gagal menambahkan dokumen', error);
  }
}
