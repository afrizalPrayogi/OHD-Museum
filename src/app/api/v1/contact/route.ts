import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { parsePaginationParams } from '@/utils/pagination';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'contact:read')) {
      return apiForbidden('Izin melihat pesan kontak tidak memadai');
    }

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(request.url);
    const status = searchParams.get('status');
    const topic = searchParams.get('topic');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND c.status = $${params.length}`;
    }

    if (topic) {
      params.push(topic);
      whereClause += ` AND c.topic = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (c.full_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.message ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM contact_inquiries c ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT * FROM contact_inquiries c
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Daftar pesan kontak berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat pesan kontak', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, email, phone, topic, message } = body;

    if (!full_name || !email || !message) {
      return apiBadRequest('Nama lengkap, email, dan isi pesan wajib diisi');
    }

    const result = await query(
      `INSERT INTO contact_inquiries (
        full_name,
        email,
        phone,
        topic,
        message,
        status
      ) VALUES ($1, $2, $3, $4, $5, 'unread')
      RETURNING *`,
      [
        full_name,
        email.toLowerCase().trim(),
        phone || null,
        topic || 'general',
        message,
      ]
    );

    return apiCreated(
      result.rows[0],
      'Pesan dan pertanyaan Anda telah berhasil terkirim ke staf OHD Museum'
    );
  } catch (error) {
    return apiError('Gagal mengirim pesan kontak', error);
  }
}
