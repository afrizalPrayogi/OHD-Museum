import { query } from '@/lib/db';
import { authenticateRequest, hasPermission } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiForbidden, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

interface SettingRow {
  id: string;
  key: string;
  value: any;
  group_name: string;
  group: string;
  description: string | null;
  updated_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get('group') || searchParams.get('group_name');

    let sql = 'SELECT id, key, value, group_name, group_name AS "group", description, updated_at FROM system_settings';
    const params: any[] = [];

    if (group) {
      params.push(group);
      sql += ` WHERE group_name = $${params.length}`;
    }

    sql += ' ORDER BY group_name ASC, key ASC';

    const result = await query<SettingRow>(sql, params);

    // Format as convenient key-value map for frontend
    const map: Record<string, any> = {};
    result.rows.forEach((row: SettingRow) => {
      map[row.key] = row.value;
    });

    return apiSuccess(
      {
        settings: result.rows,
        map,
      },
      'Pengaturan sistem berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat pengaturan sistem', error);
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized();
    }
    if (!hasPermission(authUser, 'settings:update')) {
      return apiForbidden('Izin mengubah konfigurasi sistem tidak memadai');
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return apiBadRequest('Kunci (key) dan nilai (value) pengaturan wajib diisi');
    }

    const currentResult = await query('SELECT * FROM system_settings WHERE key = $1', [key]);
    if (currentResult.rows.length === 0) {
      return apiBadRequest(`Pengaturan dengan key '${key}' tidak ditemukan`);
    }
    const current = currentResult.rows[0];

    const result = await query(
      `UPDATE system_settings SET
        value = $1,
        updated_at = NOW()
       WHERE key = $2
       RETURNING id, key, value, group_name, group_name AS "group", description, updated_at`,
      [typeof value === 'object' ? JSON.stringify(value) : value, key]
    );

    const updated = result.rows[0];

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: authUser.userId,
      action: 'UPDATE',
      entityName: 'system_settings',
      recordId: key,
      oldValues: { value: current.value },
      newValues: { value: updated.value },
      ipAddress,
      userAgent,
    });

    return apiSuccess(updated, 'Pengaturan sistem berhasil diperbarui');
  } catch (error) {
    return apiError('Gagal memperbarui pengaturan sistem', error);
  }
}
