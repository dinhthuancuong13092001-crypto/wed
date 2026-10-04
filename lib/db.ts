import { databasePool } from "../scripts/database.mjs";
type DbClient = {
  query: (
    sql: string,
    values?: any[],
  ) => Promise<{ rows: any[]; rowCount: number | null }>;
  release: () => void;
};
type DbPool = { query: DbClient["query"]; connect: () => Promise<DbClient> };
const globalDb = globalThis as unknown as { schoolPool?: DbPool };
export const pool = globalDb.schoolPool ?? (databasePool() as DbPool);
if (process.env.NODE_ENV !== "production") globalDb.schoolPool = pool;
export async function query<T = any>(sql: string, values: unknown[] = []) {
  return (await pool.query(sql, values)).rows as T[];
}
export async function transaction<T>(fn: (client: DbClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
