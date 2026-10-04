import { prepareEnvironment, startDatabase, migrate } from "./runtime.mjs";
import { randomBytes, scryptSync } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { databaseClient } from "./database.mjs";
const email = (process.argv[2] || "").trim().toLowerCase();
if (
  !/^[a-zA-Z0-9._-]{3,64}$/.test(email) &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
)
  throw Error("Cần cung cấp tên đăng nhập hoặc email hợp lệ.");
let db, client;
try {
  await prepareEnvironment();
  db = await startDatabase();
  await migrate();
  client = databaseClient();
  await client.connect();
  await client.query("BEGIN");
  await client.query("LOCK TABLE users IN EXCLUSIVE MODE");
  const existing = (
    await client.query(
      "SELECT id,email,role FROM users WHERE lower(email)=$1",
      [email],
    )
  ).rows[0];
  if (existing)
    throw Error("Email này đã có tài khoản. Không thay đổi mật khẩu hiện có.");
  const password = randomBytes(18).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
  const user = (
    await client.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id",
      ["Quản trị trường Đinh Tiên Hoàng", email, hash, "SUPER_ADMIN"],
    )
  ).rows[0];
  await client.query(
    "INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)",
    [user.id, "Tạo tài khoản quản trị theo yêu cầu", "users", user.id],
  );
  await writeFile(
    "TAI_KHOAN_ADMIN.txt",
    `TÀI KHOẢN QUẢN TRỊ TRƯỜNG ĐINH TIÊN HOÀNG\n\nTên đăng nhập: ${email}\nMật khẩu ban đầu: ${password}\n\nĐăng nhập tại /admin/login.\nVào Tài khoản của tôi → Đổi mật khẩu để đặt mật khẩu riêng.\nXóa tệp này sau khi đã đổi mật khẩu.\n`,
    { mode: 0o600, flag: "wx" },
  );
  await client.query("COMMIT");
  console.log(
    "Đã tạo tài khoản SUPER_ADMIN. Thông tin đăng nhập được lưu riêng trong TAI_KHOAN_ADMIN.txt.",
  );
} catch (e) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (client) await client.end();
  if (db) await db.stop();
}
