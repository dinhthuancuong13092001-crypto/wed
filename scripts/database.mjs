import pg from "pg";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

export const isMysql = () =>
  process.env.DATABASE_URL?.startsWith("mysql://") === true;

// Translate the application's fixed PostgreSQL query vocabulary. Values remain bound.
export function mysqlSql(sql) {
  return sql
    .replace(/count\(\*\)::int/gi, "count(*)")
    .replace(/\bILIKE\b/g, "LIKE")
    .replace(
      /COALESCE\(\(c\.data->>'order'\)::int,0\)/g,
      "COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(c.data,'$.order')) AS SIGNED),0)",
    )
    .replace(
      /COALESCE\(\(c\.data->>'featured'\)::boolean,false\)/g,
      "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.data,'$.featured'))='true',false)",
    )
    .replace(/data::text/g, "CAST(data AS CHAR)")
    .replace(
      /now\(\)\+\$2 \* interval '1 second'/g,
      "TIMESTAMPADD(SECOND,$2,NOW())",
    )
    .replace(/now\(\)\+interval '12 hours'/g, "TIMESTAMPADD(HOUR,12,NOW())")
    .replace(
      /ON CONFLICT\(key\) DO UPDATE SET value=\$2(?:,updated_at=now\(\))?/g,
      (s) =>
        "ON DUPLICATE KEY UPDATE value=$2" +
        (s.includes("updated_at") ? ",updated_at=now()" : ""),
    )
    .replace(
      /ON CONFLICT\(name\) DO UPDATE SET name=excluded.name/g,
      "ON DUPLICATE KEY UPDATE name=VALUES(name)",
    )
    .replace(
      /ON CONFLICT(?:\(key\))? DO NOTHING/g,
      "ON DUPLICATE KEY UPDATE " + "__IGNORE__",
    )
    .replace(/(?<!`)\bkey\b(?!`)/g, "`key`");
}

function normalize(rows) {
  return rows.map((row) => {
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) row[key] = value.toISOString();
      if (key === "data" && typeof value === "string")
        row[key] = JSON.parse(value);
      if (["active", "visible"].includes(key)) row[key] = Boolean(value);
    }
    return row;
  });
}

/** @param {any} connection @param {string} source @param {any[]} values */
export async function mysqlQuery(connection, source, values = []) {
  if (source === "LOCK TABLE users IN EXCLUSIVE MODE") {
    // A permanent guard row also serializes setup when the users table is empty.
    await connection.query(
      "SELECT version FROM schema_migrations WHERE version=1 FOR UPDATE",
    );
    return { rows: [], rowCount: 0 };
  }
  if (source.startsWith("INSERT INTO rate_limits")) {
    await connection.beginTransaction();
    try {
      await connection.query(
        "INSERT INTO rate_limits(`key`,count,expires_at) VALUES(?,1,TIMESTAMPADD(SECOND,?,NOW())) ON DUPLICATE KEY UPDATE count=IF(expires_at<NOW(),1,count+1),expires_at=IF(expires_at<NOW(),VALUES(expires_at),expires_at)",
        values,
      );
      const [rows] = await connection.query(
        "SELECT count FROM rate_limits WHERE `key`=?",
        [values[0]],
      );
      await connection.commit();
      return { rows, rowCount: rows.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
  let sql = mysqlSql(source);
  const returning = sql.match(/\s+RETURNING\s+(.+)$/i)?.[1];
  sql = sql.replace(/\s+RETURNING\s+(.+)$/i, "");
  const table = sql.match(/^INSERT INTO (\w+)/i)?.[1];
  let id;
  if (
    table &&
    [
      "users",
      "categories",
      "posts",
      "announcements",
      "events",
      "albums",
      "videos",
      "teachers",
      "pages",
      "media",
      "menus",
      "menu_items",
      "contact_messages",
    ].includes(table) &&
    !/^INSERT INTO \w+\(id[,)]/i.test(sql)
  ) {
    id = randomUUID();
    values = [...values, id];
    sql = sql
      .replace(/^(INSERT INTO \w+)\(/i, "$1(id,")
      .replace(/VALUES\(/i, `VALUES($${values.length},`);
  }
  if (sql.includes("__IGNORE__")) {
    const column = sql.match(/^INSERT INTO \w+\(([^,)]*)/i)?.[1];
    if (!column) throw Error("Unsupported conflict query");
    sql = sql.replace("__IGNORE__", `${column}=${column}`);
  }
  const bound = [];
  sql = sql.replace(/\$(\d+)/g, (_, n) => {
    const value = values[Number(n) - 1];
    bound.push(
      value === undefined
        ? null
        : value instanceof Date
          ? value
          : typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : value,
    );
    return "?";
  });
  try {
    const [result] = await connection.query(sql, bound);
    if (returning) {
      let rows;
      if (table === "menus")
        [rows] = await connection.query(
          `SELECT ${returning} FROM menus WHERE name='main'`,
        );
      else if (id)
        [rows] = await connection.query(
          `SELECT ${returning} FROM ${table} WHERE id=?`,
          [id],
        );
      else {
        const position = source.match(/WHERE id=\$(\d+)/i)?.[1];
        if (!position) throw Error("Unsupported RETURNING query");
        [rows] = await connection.query(
          `SELECT ${returning} FROM ${source.match(/^UPDATE (\w+)/i)[1]} WHERE id=?`,
          [values[Number(position) - 1]],
        );
      }
      return { rows: normalize(rows), rowCount: rows.length };
    }
    return {
      rows: Array.isArray(result) ? normalize(result) : [],
      rowCount: Array.isArray(result) ? result.length : result.affectedRows,
    };
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") error.code = "23505";
    throw error;
  }
}

export function mysqlOptions() {
  const url = new URL(process.env.DATABASE_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    charset: "utf8mb4",
    timezone: "Z",
    connectionLimit: 10,
  };
}

export function databasePool() {
  if (!isMysql())
    return new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  const pool = mysql.createPool(mysqlOptions());
  const wrap = (c) => ({
    query: (sql, values = []) => mysqlQuery(c, sql, values),
    release: () => c.release(),
  });
  return {
    async connect() {
      const c = await pool.getConnection();
      try {
        await c.query("SET time_zone='+00:00'");
        return wrap(c);
      } catch (e) {
        c.release();
        throw e;
      }
    },
    async query(sql, values = []) {
      const c = await pool.getConnection();
      try {
        await c.query("SET time_zone='+00:00'");
        return await mysqlQuery(c, sql, values);
      } finally {
        c.release();
      }
    },
    end: () => pool.end(),
  };
}

export function databaseClient() {
  if (!isMysql())
    return new pg.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
  let connection;
  return {
    async connect() {
      connection = await mysql.createConnection(mysqlOptions());
      await connection.query("SET time_zone='+00:00'");
    },
    query: (sql, values = []) => mysqlQuery(connection, sql, values),
    async end() {
      if (connection) await connection.end();
    },
  };
}
