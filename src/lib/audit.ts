import { query } from './db';

export interface AuditParams {
  userId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  entityName: string;
  recordId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (
        user_id,
        action,
        entity_name,
        record_id,
        old_values,
        new_values,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.userId || null,
        params.action,
        params.entityName,
        params.recordId,
        params.oldValues ? JSON.stringify(params.oldValues) : null,
        params.newValues ? JSON.stringify(params.newValues) : null,
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );
  } catch (error) {
    // Non-blocking: Audit failure should not crash main request, but should be logged
    console.error('Failed to write audit log:', error);
  }
}

export function extractClientInfo(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return { ipAddress, userAgent };
}
