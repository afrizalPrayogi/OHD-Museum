import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const parentId = searchParams.get('parent_id');

    let sql = `
      SELECT c.*, p.name as parent_name,
        (SELECT COUNT(*)::int FROM categories sub WHERE sub.parent_id = c.id) as subcategories_count
      FROM categories c
      LEFT JOIN categories p ON p.id = c.parent_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      params.push(type);
      sql += ` AND c.type = $${params.length}`;
    }

    if (parentId !== null && parentId !== undefined) {
      if (parentId === 'root') {
        sql += ` AND c.parent_id IS NULL`;
      } else {
        params.push(parentId);
        sql += ` AND c.parent_id = $${params.length}`;
      }
    }

    sql += ` ORDER BY c.type ASC, c.name ASC`;

    const result = await query(sql, params);
    return apiSuccess(result.rows, 'Daftar kategori berhasil dimuat');
  } catch (error) {
    return apiError('Gagal memuat kategori', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'categories:create')) {
      return apiForbidden('Izin membuat kategori tidak memadai');
    }

    const body = await request.json();
    const { name, slug, type, description, parent_id } = body;

    if (!name || !slug || !type) {
      return apiBadRequest('Nama, slug, dan tipe kategori wajib diisi');
    }

    // Insert category
    const result = await query(
      `INSERT INTO categories (name, slug, type, description, parent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, slug.toLowerCase().trim(), type, description || null, parent_id || null]
    );

    const category = result.rows[0];

    // Audit log
    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'categories',
      recordId: category.id,
      newValues: category,
      ipAddress,
      userAgent,
    });

    return apiCreated(category, 'Kategori baru berhasil ditambahkan');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Slug kategori sudah digunakan');
    }
    return apiError('Gagal menambahkan kategori', error);
  }
}
