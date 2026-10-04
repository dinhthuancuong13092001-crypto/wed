import "dotenv/config";
import { chromium } from "@playwright/test";
import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
const origin = JSON.parse(
  await readFile(".preview-runtime.json", "utf8"),
).origin;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const name = "password-test-" + randomBytes(6).toString("hex"),
  oldPassword = randomBytes(18).toString("base64url"),
  newPassword = randomBytes(18).toString("base64url"),
  salt = randomBytes(16).toString("hex");
const user = (
  await db.query(
    "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id",
    [
      "Kiểm thử đổi mật khẩu",
      name,
      salt + ":" + scryptSync(oldPassword, salt, 64).toString("hex"),
      "AUTHOR",
    ],
  )
).rows[0];
let browser;
async function api(path, body, cookie = "") {
  const r = await fetch(origin + "/api/" + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return r;
}
try {
  const login = await api("auth/login", { email: name, password: oldPassword });
  if (login.status !== 200)
    throw Error("Login status " + login.status + ": " + (await login.text()));
  const oldCookie = login.headers.get("set-cookie").split(";")[0];
  const wrong = await api(
    "auth/password",
    { currentPassword: "incorrect", newPassword },
    oldCookie,
  );
  if (wrong.status !== 400) throw Error("Mật khẩu cũ sai chưa được chặn.");
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_EXECUTABLE ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(origin + "/admin/login");
  await page.getByLabel("Tên đăng nhập hoặc email", { exact: true }).fill(name);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(oldPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(origin + "/admin");
  await page
    .getByRole("link", { name: "Tài khoản của tôi", exact: true })
    .click();
  await page.waitForURL(origin + "/admin/account");
  await page.getByLabel("Mật khẩu hiện tại", { exact: true }).fill(oldPassword);
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(newPassword);
  await page
    .getByLabel("Nhập lại mật khẩu mới", { exact: true })
    .fill(newPassword);
  await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Đã đổi mật khẩu thành công" })
    .waitFor();
  const expired = await fetch(origin + "/api/admin/posts", {
    headers: { Cookie: oldCookie },
  });
  if (expired.status !== 401) throw Error("Phiên cũ chưa bị thu hồi.");
  if (
    (await api("auth/login", { email: name, password: oldPassword })).status !==
    401
  )
    throw Error("Mật khẩu cũ vẫn đăng nhập được.");
  if (
    (await api("auth/login", { email: name, password: newPassword })).status !==
    200
  )
    throw Error("Mật khẩu mới không đăng nhập được.");
  console.log(
    "PASS: username login, wrong current password, browser password change, old session revoked, new password login.",
  );
  // Check the real admin credential without exposing or changing its password.
  const credentials = await readFile("TAI_KHOAN_ADMIN.txt", "utf8");
  const adminPassword = credentials.match(/Mật khẩu ban đầu: (.+)/)?.[1];
  if (!adminPassword) throw Error("Thiếu mật khẩu admin ban đầu.");
  if (
    (await api("auth/login", { email: "admin", password: adminPassword }))
      .status !== 200
  )
    throw Error("Tài khoản admin không đăng nhập được.");
  console.log("PASS: real admin account login.");
} finally {
  if (browser) await browser.close();
  await db.query("DELETE FROM audit_logs WHERE user_id=$1", [user.id]);
  await db.query("DELETE FROM rate_limits WHERE key LIKE $1 OR key=$2", [
    "%" + name + "%",
    "password:" + user.id,
  ]);
  await db.query("DELETE FROM users WHERE id=$1", [user.id]);
  await db.end();
}
