import { query } from '@/lib/db';
import { apiSuccess, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    const result = await query('SELECT NOW() as current_time, current_database() as database');
    const latency = Date.now() - startTime;

    return apiSuccess(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          databaseName: result.rows[0]?.database,
          serverTime: result.rows[0]?.current_time,
          latencyMs: latency,
        },
        service: 'OHD Museum Backend REST API Layer',
        version: '1.0.0',
      },
      'Layanan backend API OHD Museum beroperasi secara normal'
    );
  } catch (error) {
    return apiError('Koneksi ke basis data PostgreSQL Render mengalami kendala', error);
  }
}
