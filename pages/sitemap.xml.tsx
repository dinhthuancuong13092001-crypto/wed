import type { GetServerSideProps } from "next";
import { publicList, settings } from "@/lib/content";
import { query } from "@/lib/db";
import { resources, Resource, defaultMenu } from "@/lib/models";
export default function Sitemap() {
  return null;
}
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const s = await settings();
  const origin =
    s.canonicalUrl || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const urls = defaultMenu.map(([, url]) => origin + url);
  for (const type of [
    "posts",
    "announcements",
    "events",
    "albums",
    "videos",
    "pages",
  ] as Resource[]) {
    const rows = await query(
      `SELECT slug FROM ${type} WHERE status='PUBLISHED' AND deleted_at IS NULL AND published_at<=now()`,
    );
    urls.push(
      ...rows.map((x) => origin + "/" + resources[type].route + "/" + x.slug),
    );
  }
  const escape = (s: string) =>
    s.replace(
      /[<>&'\"]/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          "'": "&apos;",
          '"': "&quot;",
        })[c]!,
    );
  res.setHeader("Content-Type", "application/xml");
  res.write(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls.map((u) => "<url><loc>" + escape(u) + "</loc></url>").join("") +
      "</urlset>",
  );
  res.end();
  return { props: {} };
};
