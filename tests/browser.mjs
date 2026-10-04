import "dotenv/config";
import { chromium } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdir } from "node:fs/promises";
const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tag = "browser-" + randomBytes(8).toString("hex"),
  password = randomBytes(20).toString("hex"),
  salt = randomBytes(16).toString("hex");
const user = (
  await db.query(
    "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN') RETURNING id",
    [
      "Kiểm thử trình duyệt",
      tag + "@example.test",
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    ],
  )
).rows[0];
let browser, page;
const errors = [];
let posts = [];
try {
  await mkdir("test-results", { recursive: true });
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_EXECUTABLE ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/admin/login");
  await page
    .getByLabel("Tên đăng nhập hoặc email", { exact: true })
    .fill(tag + "@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(origin + "/admin");
  await page.getByRole("heading", { name: "Chưa có bài viết nào" }).waitFor();
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Admin desktop has horizontal overflow");
  await page
    .getByRole("link", { name: "TẠO BÀI VIẾT ĐẦU TIÊN" })
    .first()
    .click();
  await page.getByPlaceholder("Nhập tiêu đề…").fill(tag + " Tiếng Việt");
  await page.waitForURL(origin + "/admin/posts/new");
  await page.locator(".editor-toolbar").waitFor();
  await page.getByPlaceholder("Nhập tiêu đề…").fill(tag + " Tiếng Việt");
  await page.locator(".tiptap").fill("Nội dung kiểm thử trên trình duyệt.");
  await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await page.getByText(tag + " Tiếng Việt", { exact: true }).waitFor();
  posts = (
    await db.query("SELECT id,slug FROM posts WHERE author_id=$1", [user.id])
  ).rows;
  if (posts.length !== 1) throw Error("Editor did not persist post");
  await page.reload();
  await page.getByText(tag + " Tiếng Việt", { exact: true }).waitFor();
  await page.goto(origin + "/tin-tuc/" + posts[0].slug);
  await page
    .getByRole("heading", { name: tag + " Tiếng Việt", exact: true })
    .waitFor();
  await page
    .getByText("Nội dung kiểm thử trên trình duyệt.", { exact: true })
    .waitFor();
  console.log("PASS browser login, editor, publish, refresh, public detail");
  await db.query("DELETE FROM posts WHERE author_id=$1", [user.id]);
  await page.goto(origin + "/");
  await page.screenshot({
    path: "test-results/public-desktop.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Public desktop overflow");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Public mobile overflow");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page
    .getByRole("link", { name: "Tin tức", exact: true })
    .first()
    .click();
  await page.waitForURL(origin + "/tin-tuc");
  await page.goto(origin + "/");
  await page.screenshot({
    path: "test-results/public-mobile.png",
    fullPage: true,
  });
  await page.goto(origin + "/admin");
  await page.getByRole("heading", { name: "Chưa có bài viết nào" }).waitFor();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Admin mobile overflow");
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Bài viết", exact: true }).click();
  await page.waitForURL(origin + "/admin/posts");
  await page.getByRole("heading", { name: "Chưa có bài viết nào" }).waitFor();
  console.log("PASS responsive layouts, mobile navigation, empty states");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const mediaLoaded = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/media") && r.request().method() === "GET",
  );
  await page.goto(origin + "/admin/media");
  await mediaLoaded;
  await page.locator("input[type=file]").setInputFiles({
    name: "browser-image.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 30, height: 20, channels: 3, background: "#1559dc" },
    })
      .png()
      .toBuffer(),
  });
  await page.getByText("browser-image.png", { exact: true }).waitFor();
  console.log("PASS media upload through browser");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL(origin + "/admin/login");
  await page.goto(origin + "/admin");
  await page.waitForURL(origin + "/admin/login");
  console.log("PASS logout and protected route");
  if (errors.length) throw Error("Browser errors: " + errors.join("; "));
  console.log("Browser QA completed without runtime errors.");
} catch (e) {
  if (page) {
    await page.screenshot({
      path: "test-results/browser-failure.png",
      fullPage: true,
    });
    console.log(await page.locator(".toast").allTextContents());
  }
  throw e;
} finally {
  if (browser) await browser.close();
  await db.query("DELETE FROM posts WHERE author_id=$1", [user.id]);
  const files = (
    await db.query("SELECT storage_key FROM media WHERE author_id=$1", [
      user.id,
    ])
  ).rows;
  await db.query("DELETE FROM media WHERE author_id=$1", [user.id]);
  const { unlink } = await import("node:fs/promises");
  for (const f of files) {
    await unlink("uploads/" + f.storage_key + ".webp").catch(() => {});
    await unlink("uploads/" + f.storage_key + "-thumb.webp").catch(() => {});
  }
  await db.query("DELETE FROM audit_logs WHERE user_id=$1", [user.id]);
  await db.query("DELETE FROM users WHERE id=$1", [user.id]);
  await db.query("DELETE FROM rate_limits WHERE key LIKE $1", [
    "%" + tag + "%",
  ]);
  await db.end();
}
