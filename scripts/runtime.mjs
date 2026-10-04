import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { databaseClient, isMysql } from "./database.mjs";
export async function prepareEnvironment() {
  if (!existsSync(".env")) {
    const secret = randomBytes(48).toString("hex"),
      password = randomBytes(24).toString("hex"),
      token = randomBytes(24).toString("hex");
    await writeFile(
      ".env",
      `DATABASE_URL=postgresql://school:${password}@127.0.0.1:54329/school\nAUTH_SECRET=${secret}\nSETUP_TOKEN=${token}\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\nPORT=3000\nHOST=127.0.0.1\nLOCAL_DATABASE=true\nLOCAL_DB_PORT=54329\nCOOKIE_SECURE=false\nMEDIA_DIR=uploads\n`,
      { mode: 0o600 },
    );
    const dotenv = await import("dotenv");
    dotenv.config({ quiet: true });
    console.log("Đã tạo .env với thông tin bảo mật ngẫu nhiên.");
  }
  for (const key of ["DATABASE_URL", "AUTH_SECRET", "NEXT_PUBLIC_SITE_URL"])
    if (!process.env[key])
      throw Error(`Missing required environment variable: ${key}`);
  if (process.env.AUTH_SECRET.length < 32)
    throw Error("AUTH_SECRET phải có ít nhất 32 ký tự.");
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (
    !["http:", "https:"].includes(site.protocol) ||
    site.username ||
    site.password
  )
    throw Error("NEXT_PUBLIC_SITE_URL phải là URL HTTP/HTTPS hợp lệ.");
  process.env.NEXT_PUBLIC_SITE_URL = site.origin;
  process.env.SITE_URL = site.origin;
  if (
    process.env.COOKIE_SECURE === "true" &&
    !process.env.NEXT_PUBLIC_SITE_URL.startsWith("https://")
  )
    throw Error("COOKIE_SECURE yêu cầu NEXT_PUBLIC_SITE_URL HTTPS.");
}
export async function startDatabase() {
  if (isMysql()) {
    if (process.env.LOCAL_DATABASE === "true")
      throw Error("MySQL yêu cầu LOCAL_DATABASE=false.");
    const client = databaseClient();
    try {
      await client.connect();
      await client.query("SELECT 1");
    } catch {
      throw Error("Không thể kết nối MySQL. Kiểm tra DATABASE_URL.");
    } finally {
      await client.end();
    }
    return null;
  }
  let embedded;
  if (process.env.LOCAL_DATABASE === "true") {
    const u = new URL(process.env.DATABASE_URL);
    if (
      !["127.0.0.1", "localhost"].includes(u.hostname) ||
      Number(u.port) !== Number(process.env.LOCAL_DB_PORT || 54329)
    )
      throw Error(
        "LOCAL_DATABASE yêu cầu DATABASE_URL trên localhost với đúng LOCAL_DB_PORT.",
      );
    const dir = path.resolve("data/postgres");
    await mkdir(path.dirname(dir), { recursive: true });
    if (process.platform !== "win32") {
      const { default: EmbeddedPostgres } = await import("embedded-postgres");
      embedded = new EmbeddedPostgres({
        databaseDir: dir,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        port: Number(process.env.LOCAL_DB_PORT || 54329),
        persistent: true,
        authMethod: "scram-sha-256",
        initdbFlags: ["--encoding=UTF8", "--locale=C"],
        postgresFlags: ["-h", "127.0.0.1"],
        onLog: () => {},
        onError: () => {},
      });
    }
    let running = false;
    const probe = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 1500,
    });
    try {
      await probe.connect();
      running = true;
    } catch {
    } finally {
      await probe.end().catch(() => {});
    }
    if (running) embedded = null;
    else if (process.platform === "win32") {
      const { windowsPostgres } = await import("./windows-postgres.mjs");
      embedded = await windowsPostgres();
    } else {
      if (!existsSync(path.join(dir, "PG_VERSION")))
        await embedded.initialise();
      await embedded.start();
      const client = embedded.getPgClient();
      await client.connect();
      const name = u.pathname.slice(1);
      try {
        if (
          !(
            await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [
              name,
            ])
          ).rowCount
        ) {
          if (!/^[a-zA-Z0-9_]+$/.test(name))
            throw Error("Tên database không hợp lệ");
          await client.query(`CREATE DATABASE "${name}"`);
        }
      } finally {
        await client.end();
      }
    }
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch {
    if (embedded) await embedded.stop();
    throw Error("Không thể kết nối cơ sở dữ liệu. Kiểm tra DATABASE_URL.");
  } finally {
    await client.end().catch(() => {});
  }
  return embedded;
}
export async function migrate() {
  const client = databaseClient();
  await client.connect();
  try {
    if (isMysql()) {
      const lock = (
        await client.query(
          "SELECT GET_LOCK('school_schema_migration',30) AS acquired",
        )
      ).rows[0];
      if (lock.acquired !== 1)
        throw Error("Không lấy được khóa migration MySQL.");
      try {
        const schema = await readFile("database/schema.mysql.sql", "utf8");
        for (const statement of schema
          .replace(/^--.*$/gm, "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean))
          await client.query(statement);
      } finally {
        await client.query("SELECT RELEASE_LOCK('school_schema_migration')");
      }
      return;
    }
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(720261)");
    await client.query(await readFile("database/schema.sql", "utf8"));
    const initialSettings = JSON.parse(
      await readFile("database/initial-settings.json", "utf8"),
    );
    for (const [key, value] of Object.entries(initialSettings))
      await client.query(
        "INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",
        [key, value],
      );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}
