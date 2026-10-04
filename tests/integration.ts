import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import sharp from "sharp";
import { hashPassword } from "../lib/security";
const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tag = "test-" + randomBytes(8).toString("hex");
const password = randomBytes(20).toString("hex");
const ids: { type: string; id: string }[] = [];
const users: string[] = [];
const media: string[] = [];
let cookie = "",
  authorCookie = "",
  foreignCookie = "";
let contacts: string[] = [];
let originalSettings: any[] = [];
let originalMenus: any[] = [];
let originalMenuItems: any[] = [];
let touchedMenus = false;
let setupCreated = false;
let passed = 0;
function check(name: string, fn: () => Promise<void>) {
  return fn().then(() => {
    passed++;
    console.log("PASS " + name);
  });
}
async function request(
  path: string,
  method = "GET",
  body?: any,
  session = cookie,
  headers: any = {},
) {
  const r = await fetch(origin + path, {
    method,
    redirect: "manual",
    headers: {
      Origin: origin,
      ...(session ? { Cookie: session } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any;
  const text = await r.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { r, data };
}
async function create(type: string, data: any = {}) {
  const { r, data: b } = await request("/api/admin/" + type, "POST", {
    title: tag + " " + type,
    excerpt: "Nội dung kiểm thử tạm thời",
    content: "<p>Nội dung kiểm thử bảo mật.</p>",
    status: "DRAFT",
    data: {},
    ...data,
  });
  assert.equal(r.status, 201, JSON.stringify(b));
  ids.push({ type, id: b.id });
  return b;
}
try {
  await check("health, anonymous access, admin redirect", async () => {
    assert.equal((await request("/api/health")).r.status, 200);
    assert.equal(
      (await request("/api/admin/posts", "GET", undefined, "")).r.status,
      401,
    );
    assert.equal((await request("/admin", "GET", undefined, "")).r.status, 307);
    assert.equal((await request("/")).r.status, 200);
    assert.equal((await request("/admin/login")).r.status, 200);
    assert.equal((await request("/unknown-" + tag)).r.status, 404);
  });
  await check("first setup creates one admin and locks setup", async () => {
    const available = (await request("/api/auth/setup")).data.available;
    const email = tag + "@example.test";
    if (available) {
      const { r, data } = await request(
        "/api/auth/setup",
        "POST",
        {
          name: "Kiểm thử quản trị",
          email,
          password,
          token: process.env.SETUP_TOKEN,
        },
        "",
      );
      assert.equal(r.status, 201, JSON.stringify(data));
      cookie = r.headers.get("set-cookie")!.split(";")[0];
      users.push(data.user.id);
      setupCreated = true;
      assert.equal(
        (
          await request("/api/auth/setup", "POST", {
            name: "Kiểm thử",
            email: tag + "2@example.test",
            password,
            token: process.env.SETUP_TOKEN,
          })
        ).r.status,
        403,
      );
    } else {
      const u = (
        await db.query(
          "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN') RETURNING id",
          ["Kiểm thử quản trị", email, hashPassword(password)],
        )
      ).rows[0];
      users.push(u.id);
    }
    const login = await request(
      "/api/auth/login",
      "POST",
      { email, password },
      "",
    );
    assert.equal(login.r.status, 200);
    cookie = login.r.headers.get("set-cookie")!.split(";")[0];
    assert.match(login.r.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(login.r.headers.get("set-cookie")!, /SameSite=Strict/);
    assert.equal(
      (await request("/api/auth/session")).data.user.role,
      "SUPER_ADMIN",
    );
  });
  await check("CSRF rejects foreign origin", async () => {
    assert.equal(
      (
        await request("/api/admin/posts", "POST", { title: tag }, cookie, {
          Origin: "https://attacker.example",
        })
      ).r.status,
      403,
    );
  });
  await check(
    "draft, publish, SEO, hide, trash, restore, unique slug",
    async () => {
      const p = await create("posts", {
        content:
          '<p>Hợp lệ</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
        data: {
          seoTitle: "SEO " + tag,
          seoDescription: "SEO description " + tag,
        },
      });
      assert(!p.content.includes("<script"));
      assert(!p.content.includes("onerror"));
      assert.equal((await request("/tin-tuc/" + p.slug)).r.status, 404);
      const published = await request("/api/admin/posts/" + p.id, "PUT", {
        ...p,
        status: "PUBLISHED",
      });
      assert.equal(published.r.status, 200);
      const detail = await request("/tin-tuc/" + p.slug);
      assert.equal(detail.r.status, 200);
      assert(detail.data.includes("SEO " + tag));
      assert((await request("/")).data.includes(p.title));
      assert((await request("/tin-tuc")).data.includes(p.title));
      assert((await request("/sitemap.xml")).data.includes(p.slug));
      assert.equal(
        (
          await request("/api/admin/posts", "POST", {
            title: p.title,
            slug: p.slug,
          })
        ).r.status,
        409,
      );
      assert.equal(
        (await request("/api/admin/posts/" + p.id, "PATCH", { action: "hide" }))
          .r.status,
        200,
      );
      assert.equal((await request("/tin-tuc/" + p.slug)).r.status, 404);
      assert.equal(
        (await request("/api/admin/posts/" + p.id, "DELETE")).r.status,
        200,
      );
      assert(
        (await request("/api/admin/posts?trash=true")).data.some(
          (x: any) => x.id === p.id,
        ),
      );
      assert.equal(
        (
          await request("/api/admin/posts/" + p.id, "PATCH", {
            action: "restore",
          })
        ).r.status,
        200,
      );
    },
  );
  await check(
    "categories, announcements, events, albums, videos, teachers, pages",
    async () => {
      const c = await create("categories", { status: "PUBLISHED" });
      const announcement = await create("announcements", {
        status: "PUBLISHED",
        data: { priority: "HIGH" },
      });
      const event = await create("events", {
        status: "PUBLISHED",
        data: {
          start: "2026-11-01T08:00:00+07:00",
          end: "2026-11-01T09:00:00+07:00",
          location: "Địa điểm kiểm thử",
        },
      });
      const album = await create("albums", {
        status: "PUBLISHED",
        data: { images: [] },
      });
      const video = await create("videos", {
        status: "PUBLISHED",
        data: { youtube: "https://youtu.be/dQw4w9WgXcQ" },
      });
      const teacher = await create("teachers", {
        status: "PUBLISHED",
        data: { position: "Kiểm thử", group: "BOARD" },
      });
      const page = await create("pages", { status: "PUBLISHED" });
      assert.equal(
        (
          await request("/api/admin/videos", "POST", {
            title: tag,
            data: { youtube: "https://evil.example" },
          })
        ).r.status,
        400,
      );
      for (const [route, item] of [
        ["thong-bao", announcement],
        ["su-kien", event],
        ["thu-vien", album],
        ["video", video],
        ["trang", page],
      ] as const)
        assert.equal(
          (await request("/" + route + "/" + item.slug)).r.status,
          200,
        );
      assert((await request("/gioi-thieu")).data.includes(teacher.title));
    },
  );
  await check(
    "image upload, thumbnail, metadata, media protection",
    async () => {
      const image = await sharp({
        create: { width: 30, height: 20, channels: 3, background: "#1256dd" },
      })
        .png()
        .toBuffer();
      const upload = await request("/api/admin/media", "POST", {
        name: tag + ".png",
        alt: "Ảnh kiểm thử",
        data: image.toString("base64"),
      });
      assert.equal(upload.r.status, 201, JSON.stringify(upload.data));
      const m = upload.data;
      media.push(m.id);
      const actual = await fetch(origin + m.url);
      assert.equal(actual.status, 200);
      assert.equal(actual.headers.get("content-type"), "image/webp");
      assert.equal((await fetch(origin + m.thumbnail)).status, 200);
      assert.equal(
        (
          await request("/api/admin/media/" + m.id, "PUT", {
            name: tag + ".webp",
            alt: "Alt mới",
          })
        ).r.status,
        200,
      );
      const bad = await request("/api/admin/media", "POST", {
        name: "bad.svg",
        data: Buffer.from("<svg><script>alert(1)</script></svg>").toString(
          "base64",
        ),
      });
      assert.equal(bad.r.status, 400);
      const a = await create("albums", {
        title: tag + " media album",
        data: { images: [m.url] },
      });
      assert.equal(
        (await request("/api/admin/media/" + m.id, "DELETE")).r.status,
        409,
      );
      await db.query("DELETE FROM albums WHERE id=$1", [a.id]);
      assert.equal(
        (await request("/api/admin/media/" + m.id, "DELETE")).r.status,
        200,
      );
      media.splice(media.indexOf(m.id), 1);
    },
  );
  await check(
    "AUTHOR ownership, server RBAC, editor restrictions",
    async () => {
      for (const [name, role] of [
        ["author", "AUTHOR"],
        ["foreign", "AUTHOR"],
        ["editor", "EDITOR"],
      ]) {
        const r = await request("/api/admin/users", "POST", {
          name: "Kiểm thử " + name,
          email: tag + "-" + name + "@example.test",
          password,
          role,
        });
        assert.equal(r.r.status, 200);
        const user = (
          await db.query("SELECT id FROM users WHERE email=$1", [
            tag + "-" + name + "@example.test",
          ])
        ).rows[0];
        users.push(user.id);
        const login = await request(
          "/api/auth/login",
          "POST",
          { email: tag + "-" + name + "@example.test", password },
          "",
        );
        const ck = login.r.headers.get("set-cookie")!.split(";")[0];
        if (name === "author") authorCookie = ck;
        if (name === "foreign") foreignCookie = ck;
        if (name === "editor")
          assert.equal(
            (await request("/api/admin/settings", "GET", undefined, ck)).r
              .status,
            403,
          );
      }
      const own = await request(
        "/api/admin/posts",
        "POST",
        { title: tag + " owned" },
        authorCookie,
      );
      assert.equal(own.r.status, 201);
      ids.push({ type: "posts", id: own.data.id });
      assert.equal(
        (
          await request(
            "/api/admin/posts/" + own.data.id,
            "DELETE",
            undefined,
            foreignCookie,
          )
        ).r.status,
        403,
      );
      assert.equal(
        (await request("/api/admin/settings", "GET", undefined, authorCookie)).r
          .status,
        403,
      );
      assert.equal(
        (await request("/api/admin/events", "GET", undefined, authorCookie)).r
          .status,
        403,
      );
      assert(
        (
          await request("/api/admin/posts", "GET", undefined, authorCookie)
        ).data.every((x: any) => x.author_id === own.data.author_id),
      );
    },
  );
  await check("search, pagination, contact validation, audit log", async () => {
    for (let i = 0; i < 13; i++)
      await create("posts", {
        title: tag + " pagination " + i,
        status: "PUBLISHED",
      });
    assert(
      (await request("/tin-tuc?q=" + tag + "&page=2")).data
        .replace(/<!--.*?-->/g, "")
        .includes("Trang 2"),
    );
    assert((await request("/tim-kiem?q=" + tag)).data.includes(tag));
    const contact = await request("/api/contact", "POST", {
      name: "Kiểm thử",
      email: tag + "@example.test",
      subject: tag,
      message: "Lời nhắn kiểm thử tạm thời",
      website: "",
    });
    assert.equal(contact.r.status, 201);
    contacts = (
      await db.query("SELECT id FROM contact_messages WHERE subject=$1", [tag])
    ).rows.map((x) => x.id);
    assert.equal(
      (
        await request("/api/contact", "POST", {
          name: "x",
          subject: "x",
          message: "x",
          website: "spam",
        })
      ).r.status,
      400,
    );
    assert((await request("/api/admin/logs")).data.length > 0);
  });
  await check("settings persist and logout revokes session", async () => {
    originalSettings = (await db.query("SELECT * FROM site_settings")).rows;
    const before = await request("/api/admin/settings");
    assert.equal(
      (
        await request("/api/admin/settings", "PUT", {
          schoolName: tag,
          primaryColor: "invalid",
        })
      ).r.status,
      400,
    );
    assert.deepEqual((await request("/api/admin/settings")).data, before.data);
    assert.equal(
      (
        await request("/api/admin/settings", "PUT", {
          canonicalUrl: "/relative",
        })
      ).r.status,
      400,
    );
    assert.equal(
      (
        await request("/api/admin/settings", "PUT", {
          schoolName: tag + " Trường kiểm thử",
        })
      ).r.status,
      200,
    );
    assert((await request("/")).data.includes(tag + " Trường kiểm thử"));
    originalMenus = (await db.query("SELECT * FROM menus")).rows;
    originalMenuItems = (await db.query("SELECT * FROM menu_items")).rows;
    touchedMenus = true;
    assert.equal(
      (
        await request("/api/admin/menus", "PUT", [
          { id: "parent", label: tag, url: "/tin-tuc", visible: true },
          {
            id: "child",
            label: tag + " child",
            url: "/thong-bao",
            parent_id: "parent",
            visible: true,
          },
        ])
      ).r.status,
      200,
    );
    assert((await request("/")).data.includes(tag + " child"));
    assert.equal(
      (await request("/api/media/00000000-0000-0000-0000-000000000000.webp")).r
        .status,
      404,
    );
    assert.equal((await request("/api/auth/logout", "POST")).r.status, 200);
    assert.equal((await request("/api/admin/posts")).r.status, 401);
  });
  console.log(`${passed} nhóm kiểm thử thành công.`);
} finally {
  for (const item of ids)
    await db.query(`DELETE FROM ${item.type} WHERE id=$1`, [item.id]);
  for (const id of media) {
    const m = (
      await db.query("SELECT storage_key FROM media WHERE id=$1", [id])
    ).rows[0];
    await db.query("DELETE FROM media WHERE id=$1", [id]);
    if (m) {
      const { deleteFile } = await import("../lib/storage");
      await deleteFile(m.storage_key + ".webp");
      await deleteFile(m.storage_key + "-thumb.webp");
    }
  }
  for (const id of contacts)
    await db.query("DELETE FROM contact_messages WHERE id=$1", [id]);
  await db.query("DELETE FROM audit_logs WHERE user_id=ANY($1::uuid[])", [
    users,
  ]);
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [users]);
  if (originalSettings.length || passed >= 8) {
    await db.query("DELETE FROM site_settings");
    for (const r of originalSettings)
      await db.query("INSERT INTO site_settings(key,value) VALUES($1,$2)", [
        r.key,
        r.value,
      ]);
  }
  if (touchedMenus) {
    await db.query("DELETE FROM menu_items");
    await db.query("DELETE FROM menus");
    for (const m of originalMenus)
      await db.query("INSERT INTO menus(id,name) VALUES($1,$2)", [
        m.id,
        m.name,
      ]);
    for (const m of originalMenuItems)
      await db.query(
        "INSERT INTO menu_items(id,menu_id,label,url,sort_order,visible) VALUES($1,$2,$3,$4,$5,$6)",
        [m.id, m.menu_id, m.label, m.url, m.sort_order, m.visible],
      );
    for (const m of originalMenuItems)
      if (m.parent_id)
        await db.query("UPDATE menu_items SET parent_id=$1 WHERE id=$2", [
          m.parent_id,
          m.id,
        ]);
  }
  await db.query("DELETE FROM rate_limits WHERE key LIKE $1", [
    "%" + tag + "%",
  ]);
  const counts: any = {};
  for (const t of ["posts", "announcements", "events", "albums", "videos"])
    counts[t] = (await db.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
  console.log("Dữ liệu sau dọn kiểm thử: " + JSON.stringify(counts));
  await db.end();
}
