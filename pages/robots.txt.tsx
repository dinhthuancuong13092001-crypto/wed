import type { GetServerSideProps } from "next";
import { settings } from "@/lib/content";
export default function Robots() {
  return null;
}
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "text/plain");
  const s = await settings();
  res.write(
    "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nSitemap: " +
      (s.canonicalUrl ||
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL) +
      "/sitemap.xml",
  );
  res.end();
  return { props: {} };
};
