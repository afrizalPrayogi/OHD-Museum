declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: any;
  }

  export interface QueryResult<R extends QueryResultRow = any> {
    rows: R[];
    command: string;
    rowCount: number | null;
    oid: number;
    fields: any[];
  }

  export interface PoolConfig {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<R extends QueryResultRow = any>(queryText: string, values?: any[]): Promise<QueryResult<R>>;
    connect(): Promise<any>;
    end(): Promise<void>;
  }
}
