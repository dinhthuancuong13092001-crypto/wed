import { test } from "node:test";
import assert from "node:assert/strict";
import { mysqlQuery, mysqlSql } from "../scripts/database.mjs";
import { readFile } from "node:fs/promises";

function fake(results = []) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return [results.shift() ?? { affectedRows: 1 }];
    },
    async beginTransaction() {
      calls.push({ sql: "BEGIN" });
    },
    async commit() {
      calls.push({ sql: "COMMIT" });
    },
    async rollback() {
      calls.push({ sql: "ROLLBACK" });
    },
  };
}

test("bind repeated and reordered placeholders without interpolating input", async () => {
  const c = fake([[]]);
  const input = "x' OR 1=1 --";
  await mysqlQuery(
    c,
    "SELECT * FROM posts WHERE title ILIKE $2 OR slug=$2 LIMIT $1",
    [12, input],
  );
  assert.equal(
    c.calls[0].sql,
    "SELECT * FROM posts WHERE title LIKE ? OR slug=? LIMIT ?",
  );
  assert.deepEqual(c.calls[0].values, [input, input, 12]);
});

test("insert returning uses the generated UUID and normalizes JSON/dates", async () => {
  const date = new Date("2026-01-01T00:00:00Z");
  const c = fake([
    { affectedRows: 1 },
    [{ data: '{"featured":true}', created_at: date, active: 0 }],
  ]);
  const result = await mysqlQuery(
    c,
    "INSERT INTO posts(title,data,published_at) VALUES($1,$2,$3) RETURNING *",
    ["Bài viết", { featured: true }, date],
  );
  assert.match(c.calls[0].values[0], /^[0-9a-f-]{36}$/);
  assert.equal(c.calls[0].values[2], '{"featured":true}');
  assert.equal(c.calls[1].values[0], c.calls[0].values[0]);
  assert.deepEqual(result.rows[0], {
    data: { featured: true },
    created_at: date.toISOString(),
    active: false,
  });
});

test("update returning retrieves by the bound ID", async () => {
  const c = fake([{ affectedRows: 1 }, [{ id: "test" }]]);
  await mysqlQuery(c, "UPDATE posts SET title=$1 WHERE id=$2 RETURNING *", [
    "Updated",
    "test",
  ]);
  assert.deepEqual(c.calls[1], {
    sql: "SELECT * FROM posts WHERE id=?",
    values: ["test"],
  });
});

test("explicit menu item IDs are preserved and conflicts use existing menu", async () => {
  const c = fake([
    { affectedRows: 1 },
    { affectedRows: 2 },
    [{ id: "existing" }],
  ]);
  await mysqlQuery(
    c,
    "INSERT INTO menu_items(id,menu_id,label,url) VALUES($1,$2,$3,$4)",
    ["item", "menu", "Label", "/"],
  );
  assert.equal(c.calls[0].values[0], "item");
  const result = await mysqlQuery(
    c,
    "INSERT INTO menus(name) VALUES('main') ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id",
  );
  assert.equal(result.rows[0].id, "existing");
  assert.match(c.calls[1].sql, /ON DUPLICATE KEY UPDATE/);
});

test("setup serialization locks a persistent row, not an empty users table", async () => {
  const c = fake([[]]);
  await mysqlQuery(c, "LOCK TABLE users IN EXCLUSIVE MODE");
  assert.match(c.calls[0].sql, /schema_migrations WHERE version=1 FOR UPDATE/);
});

test("album conflict keeps placeholder order and avoids duplicate association", async () => {
  const c = fake();
  await mysqlQuery(
    c,
    "INSERT INTO album_images(album_id,media_id,sort_order) SELECT $1,id,$3 FROM media WHERE url=$2 ON CONFLICT DO NOTHING",
    ["album", "/image", 3],
  );
  assert.deepEqual(c.calls[0].values, ["album", 3, "/image"]);
  assert.match(c.calls[0].sql, /ON DUPLICATE KEY UPDATE album_id=album_id/);
});

test("rate limit reads its count under the same transaction and rolls back failures", async () => {
  const c = fake([{ affectedRows: 1 }, [{ count: 11 }]]);
  const result = await mysqlQuery(
    c,
    "INSERT INTO rate_limits(key,count,expires_at)",
    ["login", 600],
  );
  assert.equal(result.rows[0].count, 11);
  assert.equal(c.calls[0].sql, "BEGIN");
  assert.equal(c.calls.at(-1).sql, "COMMIT");
  const failure = fake();
  failure.query = async () => {
    throw Error("offline");
  };
  await assert.rejects(
    mysqlQuery(failure, "INSERT INTO rate_limits", ["login", 600]),
    /offline/,
  );
  assert.equal(failure.calls.at(-1).sql, "ROLLBACK");
});

test("MySQL schema stays intact and contains all application resources", async () => {
  const schema = await readFile("database/schema.mysql.sql", "utf8");
  assert.equal(mysqlSql(schema), schema);
  assert.equal(schema, await readFile("school.mysql.sql", "utf8"));
  for (const table of [
    "users",
    "posts",
    "announcements",
    "events",
    "albums",
    "videos",
    "teachers",
    "pages",
    "categories",
    "media",
    "sessions",
    "menus",
    "contact_messages",
  ])
    assert.ok(schema.includes(`CREATE TABLE IF NOT EXISTS ${table} (`));
  assert.doesNotMatch(schema, /pg_advisory|jsonb|timestamptz|ON CONFLICT/);
});

test("unique violations retain the existing API error contract", async () => {
  const c = fake();
  c.query = async () => {
    throw Object.assign(Error("duplicate"), { code: "ER_DUP_ENTRY" });
  };
  await assert.rejects(
    mysqlQuery(c, "INSERT INTO users(name) VALUES($1)", ["A"]),
    { code: "23505" },
  );
});
