import sanitizeHtml from "sanitize-html";
import { z } from "zod";
export const uuid = z.uuid();
export const loginIdentifier = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .refine(
    (value) =>
      /^[a-zA-Z0-9._-]{3,64}$/.test(value) ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Nhập tên đăng nhập hợp lệ hoặc email.",
  );
export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);
}
export function safeUrl(s: string) {
  return s === "" || /^\/(?!\/)/.test(s) || /^https?:\/\//i.test(s);
}
export const url = z
  .string()
  .max(2000)
  .refine(safeUrl, "URL phải bắt đầu bằng /, http:// hoặc https://");
export const contentSchema = z.object({
  title: z.string().trim().min(1).max(250),
  slug: z.string().max(150).optional(),
  excerpt: z.string().max(1000).default(""),
  content: z.string().max(300000).default(""),
  cover: url.default(""),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).default("DRAFT"),
  category_id: uuid.nullable().optional(),
  published_at: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "iframe", "u", "video"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height", "loading"],
      iframe: ["src", "allowfullscreen", "width", "height", "frameborder"],
      video: ["src", "controls", "preload", "playsinline"],
      "*": ["style"],
    },
    allowedStyles: { "*": { "text-align": [/^(left|center|right)$/] } },
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
  });
}
export function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be")
      return /^[\w-]{11}$/.test(u.pathname.slice(1))
        ? u.pathname.slice(1)
        : null;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
    ) {
      const id = u.searchParams.get("v") || u.pathname.split("/").pop() || "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {}
  return null;
}
