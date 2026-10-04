import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import sharp from "sharp";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { query, transaction } from "@/lib/db";
import {
  currentUser,
  requireUser,
  requireRole,
  sameOrigin,
  rateLimit,
  clientIp,
  hashPassword,
  verifyPassword,
  createSession,
  tokenHash,
  HttpError,
  audit,
} from "@/lib/security";
import {
  contentSchema,
  cleanHtml,
  slugify,
  url,
  uuid,
  youtubeId,
  loginIdentifier,
} from "@/lib/validation";
import { isResource, settings } from "@/lib/content";
import { putFile, getFile, deleteFile } from "@/lib/storage";
import { settingFields } from "@/lib/models";
export const config = { api: { bodyParser: { sizeLimit: "70mb" } } };
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  const parts = (req.query.path as string[]) || [];
  const [area, type, id] = parts;
  try {
    if (area === "health") {
      await query("SELECT 1");
      return res.status(200).json({ status: "ok" });
    }
    if (area === "media" && req.method === "GET") {
      if (!type || !/^([a-f0-9-]+)(-thumb)?\.(webp|mp4)$/.test(type))
        throw new HttpError(404, "Không tìm thấy ảnh.");
      let file;
      try {
        file = await getFile(type);
      } catch {
        throw new HttpError(404, "Không tìm thấy ảnh.");
      }
      res.setHeader("Content-Type", type.endsWith(".mp4") ? "video/mp4" : "image/webp");
      res.setHeader("Cache-Control", "public,max-age=31536000,immutable");
      res.setHeader("Accept-Ranges", "bytes");
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start = range?.[1] ? Number(range[1]) : 0;
        let end = range?.[2] ? Number(range[2]) : file.length - 1;
        if (range && !range[1] && range[2]) { start = Math.max(0, file.length - Number(range[2])); end = file.length - 1; }
        end = Math.min(end, file.length - 1);
        if (!range || (!range[1] && !range[2]) || start > end || start >= file.length) {
          res.setHeader("Content-Range", `bytes */${file.length}`);
          return res.status(416).end();
        }
        res.setHeader("Content-Range", `bytes ${start}-${end}/${file.length}`);
        res.setHeader("Content-Length", end - start + 1);
        return res.status(206).send(file.subarray(start, end + 1));
      }
      return res.send(file);
    }
    if (!["GET", "HEAD"].includes(req.method || "")) sameOrigin(req);
    if (area === "auth") {
      if (type === "session" && req.method === "GET")
        return res.json({ user: await currentUser(req) });
      if (type === "setup" && req.method === "GET") {
        const [r] = await query(
          "SELECT count(*)::int count FROM users WHERE role='SUPER_ADMIN'",
        );
        return res.json({ available: r.count === 0 });
      }
      if (type === "login" && req.method === "POST") {
        const b = z
          .object({ email: loginIdentifier, password: z.string().max(200) })
          .parse(req.body);
        await rateLimit("login:" + clientIp(req));
        await rateLimit("login-email:" + b.email.toLowerCase(), 10, 600);
        const [u] = await query(
          "SELECT * FROM users WHERE lower(email)=$1 AND active=true",
          [b.email.toLowerCase()],
        );
        if (!u || !verifyPassword(b.password, u.password_hash))
          throw new HttpError(401, "Tên đăng nhập hoặc mật khẩu không đúng.");
        await createSession(u.id, res);
        await audit(u, "Đăng nhập", "users", u.id);
        return res.json({
          user: { id: u.id, name: u.name, email: u.email, role: u.role },
        });
      }
      if (type === "setup" && req.method === "POST") {
        await rateLimit("setup:" + clientIp(req), 5);
        const b = z
          .object({
            name: z.string().trim().min(2).max(100),
            email: loginIdentifier,
            password: z.string().min(12).max(200),
            token: z.string().min(1),
          })
          .parse(req.body);
        const expected = process.env.SETUP_TOKEN || "";
        if (
          !expected ||
          Buffer.byteLength(expected) !== Buffer.byteLength(b.token) ||
          !timingSafeEqual(Buffer.from(expected), Buffer.from(b.token))
        )
          throw new HttpError(
            403,
            "Mã thiết lập không đúng. Xem hướng dẫn trên máy chủ.",
          );
        const u = await transaction(async (c) => {
          await c.query("LOCK TABLE users IN EXCLUSIVE MODE");
          const existing = await c.query(
            "SELECT id FROM users WHERE role='SUPER_ADMIN'",
          );
          if (existing.rowCount)
            throw new HttpError(403, "Thiết lập đã hoàn tất.");
          return (
            await c.query(
              "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN') RETURNING id,name,email,role",
              [b.name, b.email.toLowerCase(), hashPassword(b.password)],
            )
          ).rows[0];
        });
        await createSession(u.id, res);
        await audit(u, "Thiết lập quản trị", "users", u.id);
        return res.status(201).json({ user: u });
      }
      if (type === "logout" && req.method === "POST") {
        if (req.cookies.school_session)
          await query("DELETE FROM sessions WHERE token_hash=$1", [
            tokenHash(req.cookies.school_session),
          ]);
        res.setHeader(
          "Set-Cookie",
          "school_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
        );
        return res.json({ ok: true });
      }
      if (type === "password" && req.method === "POST") {
        const user = await requireUser(req);
        await rateLimit("password:" + user.id, 5, 600);
        const b = z
          .object({
            currentPassword: z.string().min(1).max(200),
            newPassword: z.string().min(12).max(200),
          })
          .parse(req.body);
        if (b.currentPassword === b.newPassword)
          throw new HttpError(400, "Mật khẩu mới phải khác mật khẩu hiện tại.");
        await transaction(async (c) => {
          const row = (
            await c.query(
              "SELECT password_hash,active FROM users WHERE id=$1 FOR UPDATE",
              [user.id],
            )
          ).rows[0];
          if (
            !row?.active ||
            !verifyPassword(b.currentPassword, row.password_hash)
          )
            throw new HttpError(400, "Mật khẩu hiện tại không đúng.");
          await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
            hashPassword(b.newPassword),
            user.id,
          ]);
          await c.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
          await c.query(
            "INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)",
            [user.id, "Đổi mật khẩu", "users", user.id],
          );
        });
        await createSession(user.id, res);
        return res.json({ ok: true });
      }
      throw new HttpError(405, "Phương thức không được hỗ trợ.");
    }
    if (area === "contact" && req.method === "POST") {
      await rateLimit("contact:" + clientIp(req), 5, 3600);
      const b = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.union([z.email(), z.literal("")]).default(""),
          phone: z.string().max(30).default(""),
          subject: z.string().trim().min(2).max(250),
          message: z.string().trim().min(10).max(10000),
          website: z.string().max(0).optional(),
        })
        .parse(req.body);
      await query(
        "INSERT INTO contact_messages(name,email,phone,subject,message) VALUES($1,$2,$3,$4,$5)",
        [b.name, b.email, b.phone, b.subject, b.message],
      );
      return res.status(201).json({ ok: true });
    }
    if (area !== "admin") throw new HttpError(404, "Không tìm thấy.");
    const u = await requireUser(req);
    if (type === "dashboard" && req.method === "GET") {
      const counts: Record<string, number> = {};
      for (const table of [
        "posts",
        "announcements",
        "events",
        "albums",
        "videos",
      ]) {
        const [r] = await query(
          `SELECT count(*)::int count FROM ${table} WHERE deleted_at IS NULL${u.role === "AUTHOR" ? " AND author_id=$1" : ""}`,
          u.role === "AUTHOR" ? [u.id] : [],
        );
        counts[table] = r.count;
      }
      return res.json({ counts });
    }
    if (type === "settings") {
      requireRole(u, ["SUPER_ADMIN", "ADMIN"]);
      if (req.method === "GET") return res.json(await settings());
      if (req.method === "PUT") {
        const b = z.record(z.string(), z.string().max(10000)).parse(req.body);
        for (const [key, value] of Object.entries(b)) {
          if (!Object.hasOwn(settingFields, key)) continue;
          if (
            [
              "logo",
              "favicon",
              "heroImage",
              "heroLink",
              "website",
              "facebook",
              "youtube",
              "tiktok",
              "maps",
              "mapsEmbed",
              "canonicalUrl",
            ].includes(key)
          )
            url.parse(value);
          if (key === "canonicalUrl" && value) {
            z.url()
              .refine(
                (v) => /^https?:\/\//.test(v),
                "Tên miền phải là URL HTTP/HTTPS",
              )
              .parse(value);
          }
          if (key === "mapsEmbed" && value) {
            const mapUrl = new URL(value);
            if (mapUrl.protocol !== "https:" || mapUrl.hostname !== "www.google.com" || !mapUrl.pathname.startsWith("/maps/embed"))
              throw new HttpError(400, "Liên kết bản đồ nhúng phải bắt đầu bằng https://www.google.com/maps/embed.");
          }
          if (key === "primaryColor" && value && !/^#[0-9a-f]{6}$/i.test(value))
            throw new HttpError(400, "Màu phải có định dạng #RRGGBB.");
        }
        await transaction(async (c) => {
          for (const [key, value] of Object.entries(b)) {
            if (!Object.hasOwn(settingFields, key)) continue;
            await c.query(
              "INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2,updated_at=now()",
              [key, value],
            );
            if (["seoTitle", "seoDescription", "canonicalUrl"].includes(key))
              await c.query(
                "INSERT INTO seo_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
                [key, value],
              );
          }
        });
        await audit(u, "Cập nhật cấu hình", "settings");
        return res.json({ ok: true });
      }
    }
    if (type === "menus") {
      requireRole(u, ["SUPER_ADMIN", "ADMIN"]);
      if (req.method === "GET")
        return res.json(
          await query("SELECT * FROM menu_items ORDER BY sort_order"),
        );
      if (req.method === "PUT") {
        const b = z
          .array(
            z.object({
              id: z.string().optional(),
              label: z.string().trim().min(1).max(80),
              url,
              sort_order: z.number().int().default(0),
              parent_id: z.string().nullable().optional(),
              visible: z.boolean().default(true),
            }),
          )
          .max(50)
          .parse(req.body);
        await transaction(async (c) => {
          const m = (
            await c.query(
              "INSERT INTO menus(name) VALUES('main') ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id",
            )
          ).rows[0];
          await c.query("DELETE FROM menu_items WHERE menu_id=$1", [m.id]);
          const ids = new Map(
            b.map((x, i) => [x.id || String(i), randomUUID()]),
          );
          for (const [i, item] of b.entries())
            await c.query(
              "INSERT INTO menu_items(id,menu_id,label,url,sort_order,visible) VALUES($1,$2,$3,$4,$5,$6)",
              [
                ids.get(item.id || String(i)),
                m.id,
                item.label,
                item.url,
                i,
                item.visible,
              ],
            );
          for (const [i, item] of b.entries())
            if (item.parent_id && ids.has(item.parent_id))
              await c.query("UPDATE menu_items SET parent_id=$1 WHERE id=$2", [
                ids.get(item.parent_id),
                ids.get(item.id || String(i)),
              ]);
        });
        await audit(u, "Cập nhật menu", "menus");
        return res.json({ ok: true });
      }
    }
    if (type === "users") {
      requireRole(u, ["SUPER_ADMIN"]);
      if (req.method === "GET")
        return res.json(
          await query(
            "SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at",
          ),
        );
      if (["POST", "PUT"].includes(req.method || "")) {
        const b = z
          .object({
            name: z.string().trim().min(2).max(100),
            email: loginIdentifier,
            role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "AUTHOR"]),
            password: z.string().min(12).max(200).optional(),
            active: z.boolean().default(true),
          })
          .parse(req.body);
        if (id) {
          uuid.parse(id);
          await transaction(async (c) => {
            await c.query("LOCK TABLE users IN EXCLUSIVE MODE");
            const old = (
              await c.query("SELECT role FROM users WHERE id=$1", [id])
            ).rows[0];
            if (!old) throw new HttpError(404, "Không tìm thấy người dùng.");
            if (
              old.role === "SUPER_ADMIN" &&
              (b.role !== "SUPER_ADMIN" || !b.active)
            ) {
              const admins = (
                await c.query(
                  "SELECT id FROM users WHERE role='SUPER_ADMIN' AND active=true",
                )
              ).rows;
              if (admins.length <= 1)
                throw new HttpError(
                  400,
                  "Cần giữ ít nhất một Super Admin hoạt động.",
                );
            }
            await c.query(
              "UPDATE users SET name=$1,email=$2,role=$3,active=$4 WHERE id=$5",
              [b.name, b.email.toLowerCase(), b.role, b.active, id],
            );
            if (b.password)
              await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
                hashPassword(b.password),
                id,
              ]);
            await c.query("DELETE FROM sessions WHERE user_id=$1", [id]);
          });
        } else {
          if (!b.password) throw new HttpError(400, "Vui lòng nhập mật khẩu.");
          await query(
            "INSERT INTO users(name,email,role,password_hash,active) VALUES($1,$2,$3,$4,$5)",
            [
              b.name,
              b.email.toLowerCase(),
              b.role,
              hashPassword(b.password),
              b.active,
            ],
          );
        }
        await audit(u, "Lưu người dùng", "users", id);
        return res.json({ ok: true });
      }
    }
    if (type === "logs") {
      requireRole(u, ["SUPER_ADMIN", "ADMIN"]);
      return res.json(
        await query(
          "SELECT a.*,u.name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200",
        ),
      );
    }
    if (type === "contacts") {
      requireRole(u, ["SUPER_ADMIN", "ADMIN", "EDITOR"]);
      if (req.method === "GET")
        return res.json(
          await query(
            "SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200",
          ),
        );
      if (req.method === "PUT") {
        uuid.parse(id);
        await query("UPDATE contact_messages SET status=$1 WHERE id=$2", [
          z.enum(["UNREAD", "READ"]).parse(req.body.status),
          id,
        ]);
        return res.json({ ok: true });
      }
    }
    if (type === "media") {
      if (req.method === "GET")
        return res.json(
          await query(
            `SELECT * FROM media ${u.role === "AUTHOR" ? "WHERE author_id=$1" : ""} ORDER BY created_at DESC`,
            u.role === "AUTHOR" ? [u.id] : [],
          ),
        );
      if (req.method === "POST") {
        await rateLimit("upload:" + u.id, 40, 60);
        const b = z
          .object({
            name: z.string().min(1).max(200),
            data: z.string().max(71000000),
            alt: z.string().max(300).default(""),
          })
          .parse(req.body);
        const file = Buffer.from(b.data, "base64");
        if (/\.mp4$/i.test(b.name)) {
          if (file.length > 50 * 1024 * 1024) throw new HttpError(400, "Clip MP4 tối đa 50 MB.");
          if (file.length < 16 || file.toString("ascii", 4, 8) !== "ftyp" || !["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(file.toString("ascii", 8, 12)))
            throw new HttpError(400, "Tệp không phải clip MP4 hợp lệ.");
          const key = randomUUID();
          await putFile(key + ".mp4", file, "video/mp4");
          const [m] = await query("INSERT INTO media(name,alt,url,thumbnail,mime,size,storage_key,author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [b.name, b.alt, "/api/media/" + key + ".mp4", "", "video/mp4", file.length, key, u.id]);
          await audit(u, "Tải clip", "media", m.id);
          return res.status(201).json(m);
        }
        if (file.length > 10 * 1024 * 1024)
          throw new HttpError(400, "Ảnh tối đa 10 MB.");
        let metadata;
        try {
          metadata = await sharp(file, {
            limitInputPixels: 40000000,
          }).metadata();
        } catch {
          throw new HttpError(400, "Tệp không phải ảnh hợp lệ.");
        }
        if (!["jpeg", "png", "webp", "avif"].includes(metadata.format || ""))
          throw new HttpError(400, "Chỉ hỗ trợ JPG, PNG, WEBP, AVIF.");
        const key = randomUUID();
        const full = await sharp(file, { limitInputPixels: 40000000 })
          .rotate()
          .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        const thumb = await sharp(full)
          .resize(480, 320, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
        await putFile(key + ".webp", full, "image/webp");
        await putFile(key + "-thumb.webp", thumb, "image/webp");
        const [m] = await query(
          "INSERT INTO media(name,alt,url,thumbnail,mime,size,storage_key,author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            b.name,
            b.alt,
            "/api/media/" + key + ".webp",
            "/api/media/" + key + "-thumb.webp",
            "image/webp",
            full.length,
            key,
            u.id,
          ],
        );
        await audit(u, "Tải ảnh", "media", m.id);
        return res.status(201).json(m);
      }
      uuid.parse(id);
      const [m] = await query("SELECT * FROM media WHERE id=$1", [id]);
      if (!m) throw new HttpError(404, "Không tìm thấy ảnh.");
      if (u.role === "AUTHOR" && m.author_id !== u.id)
        throw new HttpError(403, "Bạn chỉ được quản lý ảnh của mình.");
      if (req.method === "PUT") {
        const b = z
          .object({
            name: z.string().min(1).max(200),
            alt: z.string().max(300),
          })
          .parse(req.body);
        await query("UPDATE media SET name=$1,alt=$2 WHERE id=$3", [
          b.name,
          b.alt,
          id,
        ]);
        return res.json({ ok: true });
      }
      if (req.method === "DELETE") {
        for (const table of [
          "posts",
          "announcements",
          "events",
          "albums",
          "videos",
          "teachers",
          "pages",
        ]) {
          const [used] = await query(
            `SELECT count(*)::int n FROM ${table} WHERE cover=$1 OR content LIKE $2 OR data::text LIKE $2`,
            [m.url, "%" + m.url + "%"],
          );
          if (used.n)
            throw new HttpError(
              409,
              "Ảnh đang được sử dụng. Gỡ ảnh khỏi nội dung trước khi xóa.",
            );
        }
        const [used] = await query(
          "SELECT count(*)::int n FROM site_settings WHERE value=$1",
          [m.url],
        );
        if (used.n)
          throw new HttpError(409, "Ảnh đang được sử dụng trong cấu hình.");
        await query("DELETE FROM media WHERE id=$1", [id]);
        await deleteFile(m.storage_key + (m.mime === "video/mp4" ? ".mp4" : ".webp"));
        if (m.mime !== "video/mp4") await deleteFile(m.storage_key + "-thumb.webp");
        await audit(u, "Xóa ảnh", "media", id);
        return res.json({ ok: true });
      }
    }
    if (!isResource(type)) throw new HttpError(404, "Không tìm thấy.");
    if (u.role === "AUTHOR" && type !== "posts")
      throw new HttpError(403, "Tác giả chỉ được quản lý bài viết của mình.");
    if (id) uuid.parse(id);
    if (req.method === "GET") {
      const values: unknown[] = [];
      let where = "1=1";
      if (u.role === "AUTHOR") {
        values.push(u.id);
        where += ` AND c.author_id=$${values.length}`;
      }
      if (id) {
        values.push(id);
        where += ` AND c.id=$${values.length}`;
      } else
        where +=
          req.query.trash === "true"
            ? " AND c.deleted_at IS NOT NULL"
            : " AND c.deleted_at IS NULL";
      const rows = await query(
        `SELECT c.*,u.name AS author_name,k.title AS category_name FROM ${type} c LEFT JOIN users u ON u.id=c.author_id LEFT JOIN categories k ON k.id=c.category_id WHERE ${where} ORDER BY c.created_at DESC`,
        values,
      );
      return res.json(id ? rows[0] || null : rows);
    }
    if (id) {
      const [old] = await query(`SELECT * FROM ${type} WHERE id=$1`, [id]);
      if (!old) throw new HttpError(404, "Không tìm thấy nội dung.");
      if (u.role === "AUTHOR" && old.author_id !== u.id)
        throw new HttpError(403, "Bạn chỉ được quản lý bài viết của mình.");
    }
    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "Thiếu ID.");
      await query(
        `UPDATE ${type} SET deleted_at=now(),updated_at=now() WHERE id=$1`,
        [id],
      );
      await audit(u, "Chuyển vào thùng rác", type, id);
      return res.json({ ok: true });
    }
    if (req.method === "PATCH") {
      if (!id) throw new HttpError(400, "Thiếu ID.");
      const action = z.enum(["restore", "hide"]).parse(req.body.action);
      await query(
        `UPDATE ${type} SET ${action === "restore" ? "deleted_at=NULL" : "status='HIDDEN'"},updated_at=now() WHERE id=$1`,
        [id],
      );
      await audit(
        u,
        action === "restore" ? "Khôi phục" : "Ẩn nội dung",
        type,
        id,
      );
      return res.json({ ok: true });
    }
    if (["POST", "PUT"].includes(req.method || "")) {
      const b = contentSchema.parse(req.body);
      const slug = slugify(b.slug || b.title);
      if (!slug) throw new HttpError(400, "Slug không hợp lệ.");
      if (type === "videos" && !youtubeId(String(b.data.youtube || "")))
        throw new HttpError(400, "Vui lòng nhập URL YouTube hợp lệ.");
      if (type === "events") {
        for (const key of ["start", "end"])
          if (!b.data[key] || !Number.isFinite(Date.parse(String(b.data[key]))))
            throw new HttpError(
              400,
              "Vui lòng nhập thời gian bắt đầu và kết thúc.",
            );
        if (Date.parse(String(b.data.end)) < Date.parse(String(b.data.start)))
          throw new HttpError(400, "Kết thúc phải sau bắt đầu.");
      }
      for (const key of [
        "seoTitle",
        "seoDescription",
        "position",
        "department",
        "location",
      ])
        if (b.data[key] !== undefined) z.string().max(1000).parse(b.data[key]);
      for (const key of ["attachment", "canonical", "ogImage"])
        if (b.data[key]) url.parse(b.data[key]);
      if (b.data.images) z.array(url).max(200).parse(b.data.images);
      if (b.data.featured !== undefined) z.boolean().parse(b.data.featured);
      if (b.data.order !== undefined) z.number().int().parse(b.data.order);
      if (b.data.email) z.email().parse(b.data.email);
      if (b.data.group) z.enum(["BOARD", "TEACHER"]).parse(b.data.group);
      if (b.data.priority)
        z.enum(["NORMAL", "HIGH", "URGENT"]).parse(b.data.priority);
      const date = b.published_at ? new Date(b.published_at) : new Date();
      if (!Number.isFinite(date.getTime()))
        throw new HttpError(400, "Ngày đăng không hợp lệ.");
      const fields = [
        b.title,
        slug,
        b.excerpt,
        cleanHtml(b.content),
        b.cover,
        b.status,
        b.category_id || null,
        date,
        b.data,
      ];
      const row = await transaction(async (c) => {
        let record;
        if (id) {
          record = (
            await c.query(
              `UPDATE ${type} SET title=$1,slug=$2,excerpt=$3,content=$4,cover=$5,status=$6,category_id=$7,published_at=$8,data=$9,updated_at=now() WHERE id=$10 RETURNING *`,
              [...fields, id],
            )
          ).rows[0];
        } else {
          record = (
            await c.query(
              `INSERT INTO ${type}(title,slug,excerpt,content,cover,status,category_id,published_at,data,author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
              [...fields, u.id],
            )
          ).rows[0];
        }
        if (type === "posts") {
          await c.query("DELETE FROM post_categories WHERE post_id=$1", [
            record.id,
          ]);
          if (b.category_id)
            await c.query(
              "INSERT INTO post_categories(post_id,category_id) VALUES($1,$2)",
              [record.id, b.category_id],
            );
        }
        if (type === "albums") {
          await c.query("DELETE FROM album_images WHERE album_id=$1", [
            record.id,
          ]);
          const images = (b.data.images || []) as string[];
          for (const [i, image] of images.entries())
            await c.query(
              "INSERT INTO album_images(album_id,media_id,sort_order) SELECT $1,id,$3 FROM media WHERE url=$2 ON CONFLICT DO NOTHING",
              [record.id, image, i],
            );
        }
        return record;
      });
      await audit(
        u,
        b.status === "PUBLISHED" ? "Xuất bản" : "Lưu nội dung",
        type,
        row.id,
      );
      return res.status(id ? 200 : 201).json(row);
    }
    throw new HttpError(405, "Phương thức không được hỗ trợ.");
  } catch (e: any) {
    if (e instanceof HttpError)
      return res.status(e.status).json({ error: e.message });
    if (e instanceof z.ZodError)
      return res.status(400).json({
        error: e.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      });
    if (e.code === "23505")
      return res.status(409).json({
        error: "Slug hoặc email đã tồn tại. Vui lòng chọn giá trị khác.",
      });
    if (e.code === "23503")
      return res.status(409).json({
        error: "Dữ liệu đang được liên kết hoặc tham chiếu không tồn tại.",
      });
    console.error("API error:", e.code || e.name);
    return res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại." });
  }
}
