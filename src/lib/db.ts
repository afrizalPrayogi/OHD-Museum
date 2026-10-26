import { Pool, QueryResult, QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL || 'postgresql://db_ohdmuseum_user:rzsmbZ4nIZjkbNnr6XzgH8UneHJVhtra@dpg-dbfde2vb9u1s73cgv4m0-a.singapore-postgres.render.com/db_ohdmuseum';

export const pool =
  global.__dbPool ||
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT_MS || '10000', 10),
  });

if (process.env.NODE_ENV !== 'production') {
  global.__dbPool = pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
}
