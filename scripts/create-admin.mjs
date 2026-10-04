import { createInterface } from "node:readline/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { databaseClient } from "./database.mjs";
import { prepareEnvironment, startDatabase, migrate } from "./runtime.mjs";
const rl = createInterface({ input: process.stdin, output: process.stdout });
let db, c;
try {
  await prepareEnvironment();
  db = await startDatabase();
  await migrate();
  c = databaseClient();
  await c.connect();
  await c.query("BEGIN");
  await c.query("LOCK TABLE users IN EXCLUSIVE MODE");
  if ((await c.query("SELECT id FROM users WHERE role='SUPER_ADMIN'")).rowCount)
    throw Error("Đã có Super Admin. Dùng mục Người dùng trong quản trị.");
  const name = await rl.question("Họ tên: "),
    email = await rl.question("Email: ");
  console.log(
    "Mật khẩu sẽ hiển thị trong terminal. Có thể dùng /admin/setup để nhập mật khẩu ẩn.",
  );
  const password = await rl.question("Mật khẩu (ít nhất 12 ký tự): ");
  if (
    name.trim().length < 2 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    password.length < 12
  )
    throw Error("Thông tin không hợp lệ.");
  const salt = randomBytes(16).toString("hex");
  await c.query(
    "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN')",
    [
      name,
      email.toLowerCase(),
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    ],
  );
  await c.query("COMMIT");
  console.log("Đã tạo Super Admin.");
} catch (e) {
  if (c) await c.query("ROLLBACK").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
  if (c) await c.end();
  if (db) await db.stop();
}
