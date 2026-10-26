import { query } from '@/lib/db';
import { comparePassword, signJwt } from '@/lib/auth';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return apiBadRequest('Email dan kata sandi wajib diisi');
    }

    // Find user by email with role
    const userResult = await query(
      `SELECT u.id, u.full_name, u.email, u.password_hash, u.phone, u.is_active, u.role_id, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return apiUnauthorized('Email atau kata sandi tidak sesuai');
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return apiUnauthorized('Akun pengguna telah dinonaktifkan. Hubungi administrator');
    }

    // Compare bcrypt password
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return apiUnauthorized('Email atau kata sandi tidak sesuai');
    }

    // Fetch user permissions
    const permResult = await query<{ code: string }>(
      `SELECT p.code 
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [user.role_id]
    );

    const permissions = permResult.rows.map((r: { code: string }) => r.code);

    // Update last_login_at
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Sign JWT Token
    const token = signJwt({
      userId: user.id,
      email: user.email,
      roleId: user.role_id,
      roleName: user.role_name,
    });

    // Write audit log
    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entityName: 'users',
      recordId: user.id,
      newValues: { email: user.email, role: user.role_name },
      ipAddress,
      userAgent,
    });

    return apiSuccess(
      {
        token,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role_name,
          permissions,
        },
      },
      'Autentikasi berhasil'
    );
  } catch (error) {
    return apiError('Gagal memproses proses masuk sistem', error);
  }
}
