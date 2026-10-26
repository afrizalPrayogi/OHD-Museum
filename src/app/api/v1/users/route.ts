import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { parsePaginationParams } from '@/utils/pagination';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'users:read') && authUser.roleName !== 'super_admin') {
      return apiForbidden('Izin melihat daftar pengguna tidak memadai');
    }

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(request.url);
    const roleId = searchParams.get('role_id');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (roleId) {
      params.push(roleId);
      whereClause += ` AND u.role_id = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM users u ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        r.id as role_id,
        r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Daftar pengguna CMS berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat pengguna', error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'users:create') && authUser.roleName !== 'super_admin') {
      return apiForbidden('Izin membuat pengguna baru tidak memadai');
    }

    const body = await request.json();
    const { full_name, email, password, role_id, phone, is_active } = body;

    if (!full_name || !email || !password || !role_id) {
      return apiBadRequest('Nama lengkap, email, kata sandi, dan peran role wajib diisi');
    }

    if (password.length < 8) {
      return apiBadRequest('Kata sandi minimal 8 karakter');
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (
        role_id,
        full_name,
        email,
        password_hash,
        phone,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, full_name, email, phone, is_active, role_id, created_at`,
      [
        role_id,
        full_name,
        email.toLowerCase().trim(),
        passwordHash,
        phone || null,
        is_active ?? true,
      ]
    );

    const newUser = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'CREATE',
      entityName: 'users',
      recordId: newUser.id,
      newValues: { id: newUser.id, email: newUser.email, role_id: newUser.role_id },
      ipAddress,
      userAgent,
    });

    return apiCreated(newUser, 'Pengguna CMS berhasil dibuat');
  } catch (error: any) {
    if (error?.code === '23505') {
      return apiBadRequest('Alamat email sudah terdaftar');
    }
    return apiError('Gagal membuat pengguna', error);
  }
}
