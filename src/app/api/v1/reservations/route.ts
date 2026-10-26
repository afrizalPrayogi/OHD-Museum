import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { parsePaginationParams } from '@/utils/pagination';
import { apiSuccess, apiCreated, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized('Akses daftar reservasi memerlukan login');
    }
    if (!hasPermission(authUser, 'reservations:read')) {
      return apiForbidden('Izin melihat reservasi tidak memadai');
    }

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND r.status = $${params.length}`;
    }

    if (date) {
      params.push(date);
      whereClause += ` AND r.visit_date = $${params.length}`;
    }

    if (pagination.search) {
      params.push(`%${pagination.search}%`);
      whereClause += ` AND (r.booking_code ILIKE $${params.length} OR r.full_name ILIKE $${params.length} OR r.email ILIKE $${params.length} OR r.whatsapp_number ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM reservations r ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(pagination.limit);
    const limitIndex = params.length;
    params.push(pagination.offset);
    const offsetIndex = params.length;

    const dataResult = await query(
      `SELECT * FROM reservations r
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    return apiSuccess(
      dataResult.rows,
      'Daftar pemesanan tiket reservasi berhasil dimuat',
      {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      }
    );
  } catch (error) {
    return apiError('Gagal memuat reservasi', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      full_name,
      whatsapp_number,
      email,
      institution_city,
      visit_date,
      visit_time_slot,
      total_adults = 1,
      total_students = 0,
      need_guide = false,
    } = body;

    if (!full_name || !whatsapp_number || !email || !visit_date || !visit_time_slot) {
      return apiBadRequest('Nama lengkap, nomor WhatsApp, email, tanggal kunjungan, dan sesi waktu wajib diisi');
    }

    // Generate unique booking code: OHD-YYYYMM-XXXX
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `OHD-${yearMonth}-${randomSuffix}`;

    // Get ticket price settings from database
    const settingsResult = await query("SELECT value FROM system_settings WHERE key = 'ticket_pricing'");
    let adultPrice = 50000;
    let studentPrice = 25000;
    let guidePrice = 100000;

    if (settingsResult.rows.length > 0 && settingsResult.rows[0].value) {
      const pricing = settingsResult.rows[0].value;
      if (pricing.adult) adultPrice = Number(pricing.adult);
      if (pricing.student) studentPrice = Number(pricing.student);
      if (pricing.tour_guide) guidePrice = Number(pricing.tour_guide);
    }

    const calculatedTotal =
      Number(total_adults) * adultPrice +
      Number(total_students) * studentPrice +
      (need_guide ? guidePrice : 0);

    const result = await query(
      `INSERT INTO reservations (
        booking_code,
        full_name,
        whatsapp_number,
        email,
        institution_city,
        visit_date,
        visit_time_slot,
        total_adults,
        total_students,
        need_guide,
        status,
        total_price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)
      RETURNING *`,
      [
        bookingCode,
        full_name,
        whatsapp_number,
        email.toLowerCase().trim(),
        institution_city || null,
        visit_date,
        visit_time_slot,
        total_adults,
        total_students,
        need_guide,
        calculatedTotal,
      ]
    );

    const reservation = result.rows[0];

    return apiCreated(
      {
        ...reservation,
        instructions: {
          whatsappNotice: 'Pemesanan Anda telah tercatat. Tim admin museum akan segera menghubungi WhatsApp Anda untuk konfirmasi kehadiran.',
          totalPriceFormatted: `Rp ${Number(calculatedTotal).toLocaleString('id-ID')}`,
        },
      },
      'Reservasi tiket kunjungan berhasil dikirim'
    );
  } catch (error) {
    return apiError('Gagal memproses pemesanan kunjungan', error);
  }
}
