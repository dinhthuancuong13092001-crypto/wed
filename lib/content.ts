import { query } from "./db";
import { resources, Resource, RecordItem, Settings } from "./models";
export function isResource(s: string): s is Resource {
  return Object.hasOwn(resources, s);
}
export async function settings() {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key,value FROM site_settings",
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Settings;
}
export async function publicList(
  type: Resource,
  options: {
    q?: string;
    category?: string;
    page?: number;
    sort?: string;
    all?: boolean;
  } = {},
) {
  const values: unknown[] = [];
  let where =
    "c.status='PUBLISHED' AND c.deleted_at IS NULL AND c.published_at<=now()";
  if (options.q) {
    values.push("%" + options.q + "%");
    where += ` AND (c.title ILIKE $${values.length} OR c.excerpt ILIKE $${values.length} OR c.content ILIKE $${values.length})`;
  }
  if (options.category) {
    values.push(options.category);
    where += ` AND c.category_id=$${values.length}`;
  }
  const [count] = await query(
    `SELECT count(*)::int AS total FROM ${type} c WHERE ${where}`,
    values,
  );
  const order =
    type === "categories" || type === "teachers"
      ? "COALESCE((c.data->>'order')::int,0) ASC,c.published_at DESC"
      : options.sort === "oldest"
        ? "c.published_at ASC"
        : options.sort === "featured"
          ? "COALESCE((c.data->>'featured')::boolean,false) DESC,c.published_at DESC"
          : "c.published_at DESC";
  values.push(
    options.all ? 10000 : 12,
    options.all ? 0 : ((options.page || 1) - 1) * 12,
  );
  const rows = await query<RecordItem>(
    `SELECT c.*,u.name AS author_name,k.title AS category_name FROM ${type} c LEFT JOIN users u ON u.id=c.author_id LEFT JOIN categories k ON k.id=c.category_id WHERE ${where} ORDER BY ${order},c.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { rows, total: count.total };
}
export async function publicRecord(type: Resource, slug: string) {
  return (
    (
      await query<RecordItem>(
        `SELECT c.*,u.name AS author_name,k.title AS category_name FROM ${type} c LEFT JOIN users u ON u.id=c.author_id LEFT JOIN categories k ON k.id=c.category_id WHERE c.slug=$1 AND c.status='PUBLISHED' AND c.deleted_at IS NULL AND c.published_at<=now()`,
        [slug],
      )
    )[0] || null
  );
}
export async function menus() {
  return query(
    "SELECT i.* FROM menu_items i JOIN menus m ON m.id=i.menu_id WHERE m.name='main' AND i.visible=true ORDER BY i.sort_order,i.id",
  );
}
