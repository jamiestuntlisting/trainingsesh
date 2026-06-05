import mysql from "mysql2/promise";

// Stuntlisting import adapter — reads contacts directly from the stuntlisting
// production MySQL database. READ-ONLY: this module only ever runs SELECTs.
//
// Configure via env (never hard-code credentials):
//   STUNTLISTING_DB_HOST       RDS endpoint
//   STUNTLISTING_DB_PORT       default 3306
//   STUNTLISTING_DB_USER
//   STUNTLISTING_DB_PASSWORD
//   STUNTLISTING_DB_NAME       defaults to the user name
//   STUNTLISTING_DB_SSL        "true" to connect over TLS (RDS supports it)
//   STUNTLISTING_QUERY         the SELECT to pull contacts; must return columns
//                              aliased `email` and (optionally) `name`.

export interface ImportedContact {
  email: string;
  name: string | null;
}

const DEFAULT_QUERY =
  "SELECT email, NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') AS name " +
  "FROM users WHERE email IS NOT NULL AND email <> ''";

export function stuntlistingConfigured(): boolean {
  return Boolean(process.env.STUNTLISTING_DB_HOST && process.env.STUNTLISTING_DB_USER);
}

function connectionConfig(): mysql.ConnectionOptions {
  const useSsl = (process.env.STUNTLISTING_DB_SSL || "").toLowerCase();
  return {
    host: process.env.STUNTLISTING_DB_HOST,
    port: Number(process.env.STUNTLISTING_DB_PORT || 3306),
    user: process.env.STUNTLISTING_DB_USER,
    password: process.env.STUNTLISTING_DB_PASSWORD || "",
    database: process.env.STUNTLISTING_DB_NAME || process.env.STUNTLISTING_DB_USER,
    connectTimeout: 10_000,
    // RDS supports TLS; rejectUnauthorized:false avoids needing the CA bundle.
    ssl: ["1", "true", "yes"].includes(useSsl) ? { rejectUnauthorized: false } : undefined,
  };
}

async function withConnection<T>(fn: (c: mysql.Connection) => Promise<T>): Promise<T> {
  if (!stuntlistingConfigured()) {
    throw new Error("Stuntlisting DB is not configured (set STUNTLISTING_DB_* env vars).");
  }
  const conn = await mysql.createConnection(connectionConfig());
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

function isSelectOnly(sql: string): boolean {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  // Single statement, must start with SELECT, and contain no obvious mutations.
  if (/;/.test(trimmed)) return false;
  if (!/^select\b/i.test(trimmed)) return false;
  return !/\b(insert|update|delete|drop|alter|create|truncate|grant|replace)\b/i.test(trimmed);
}

function normalizeRows(rows: unknown[]): ImportedContact[] {
  const out: ImportedContact[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const name =
      r.name != null && String(r.name).trim() ? String(r.name).trim() : null;
    out.push({ email, name });
  }
  return out;
}

export async function fetchStuntlistingContacts(): Promise<ImportedContact[]> {
  const query = process.env.STUNTLISTING_QUERY || DEFAULT_QUERY;
  if (!isSelectOnly(query)) {
    throw new Error("STUNTLISTING_QUERY must be a single read-only SELECT statement.");
  }
  return withConnection(async (c) => {
    const [rows] = await c.query(query);
    return normalizeRows(rows as unknown[]);
  });
}

export interface StuntlistingSchema {
  database: string;
  tablesWithEmail: { table: string; columns: string[] }[];
  sample: ImportedContact[];
  sampleError: string | null;
}

// Help discover the right table/columns through the deployed app (which, unlike
// this sandbox, can reach the database). Lists tables that have an email-ish
// column, and previews the configured query.
// Connect WITHOUT selecting a database, to discover what's actually there —
// used when the configured STUNTLISTING_DB_NAME is wrong/unknown.
export interface StuntlistingDiscovery {
  databases: string[];
  emailColumns: { schema: string; table: string; column: string }[];
}

const SYSTEM_SCHEMAS = ["mysql", "information_schema", "performance_schema", "sys"];

export async function discoverStuntlistingSchema(): Promise<StuntlistingDiscovery> {
  const cfg = connectionConfig();
  delete (cfg as { database?: string }).database; // no default schema
  const conn = await mysql.createConnection(cfg);
  try {
    const [dbRows] = await conn.query("SHOW DATABASES");
    const databases = (dbRows as Record<string, unknown>[])
      .map((r) => String(Object.values(r)[0]))
      .filter((d) => !SYSTEM_SCHEMAS.includes(d));

    const [colRows] = await conn.query(
      `SELECT TABLE_SCHEMA AS s, TABLE_NAME AS t, COLUMN_NAME AS c
         FROM information_schema.columns
        WHERE COLUMN_NAME LIKE '%email%'
          AND TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`,
    );
    const emailColumns = (colRows as { s: string; t: string; c: string }[]).map((r) => ({
      schema: r.s,
      table: r.t,
      column: r.c,
    }));

    return { databases, emailColumns };
  } finally {
    await conn.end();
  }
}

export async function introspectStuntlisting(): Promise<StuntlistingSchema> {
  return withConnection(async (c) => {
    const database = (connectionConfig().database as string) || "";
    const [cols] = await c.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS col
         FROM information_schema.columns
        WHERE TABLE_SCHEMA = ?
          AND (COLUMN_NAME LIKE '%email%' OR COLUMN_NAME LIKE '%mail%')
        ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [database],
    );

    const byTable = new Map<string, string[]>();
    for (const row of cols as { t: string; col: string }[]) {
      const arr = byTable.get(row.t) ?? [];
      arr.push(row.col);
      byTable.set(row.t, arr);
    }
    const tablesWithEmail = [...byTable.entries()].map(([table, columns]) => ({ table, columns }));

    let sample: ImportedContact[] = [];
    let sampleError: string | null = null;
    try {
      const query = process.env.STUNTLISTING_QUERY || DEFAULT_QUERY;
      if (isSelectOnly(query)) {
        const [rows] = await c.query(`SELECT * FROM (${query}) AS q LIMIT 5`);
        sample = normalizeRows(rows as unknown[]);
      }
    } catch (e) {
      sampleError = e instanceof Error ? e.message : String(e);
    }

    return { database, tablesWithEmail, sample, sampleError };
  });
}
