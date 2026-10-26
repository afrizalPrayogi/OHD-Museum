import { authenticateRequest } from '@/lib/rbac';
import { logAudit, extractClientInfo } from '@/lib/audit';
import { apiSuccess, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (authUser) {
      const { ipAddress, userAgent } = extractClientInfo(request);
      await logAudit({
        userId: authUser.userId,
        action: 'LOGOUT',
        entityName: 'users',
        recordId: authUser.userId,
        newValues: { email: authUser.email },
        ipAddress,
        userAgent,
      });
    }

    return apiSuccess({ loggedOut: true }, 'Proses keluar berhasil');
  } catch (error) {
    return apiError('Gagal memproses keluar sesi', error);
  }
}
