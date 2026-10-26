import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { parsePaginationParams } from '@/utils/pagination';
import { apiSuccess, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'audit_logs:read')) {
      return apiForbidden('Izin melihat audit logs tidak memadai');
    }

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(request.url);
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const userId = searchParams.get('user_id');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (action) {
      params.push(action);
      whereClause += ` AND a.action = $${params.length}`;
    }

    if (entity) {
      params.push(entity);
      whereClause += ` AND a.entity_name = $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      whereClause += ` AND a.user_id = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (a.entity_name ILIKE $${params.length} OR a.record_id ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as total 
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT 
        a.id,
        a.action,
        a.entity_name,
        a.record_id,
        a.old_values,
        a.new_values,
        a.ip_address,
        a.user_agent,
        a.created_at,
        u.id as user_id,
        u.full_name as user_name,
        u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Catatan riwayat audit berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat catatan audit logs', error);
  }
}
