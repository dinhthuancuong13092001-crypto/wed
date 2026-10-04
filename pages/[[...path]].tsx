import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import PublicLayout from "@/components/PublicLayout";
import {
  Home,
  ListPage,
  Detail,
  About,
  Contact,
  PageTitle,
  Card,
} from "@/components/PublicContent";
import { settings, menus, publicList, publicRecord } from "@/lib/content";
import { resources, Resource } from "@/lib/models";
import { query } from "@/lib/db";
export default function PublicPage(p: any) {
  const {
    s,
    menu,
    kind,
    type,
    item,
    rows,
    total,
    page,
    search,
    categories,
    lists,
    teachers,
    related,
  } = p;
  const title =
    item?.data.seoTitle ||
    item?.title ||
    (type
      ? resources[type as Resource].label
      : kind === "home"
        ? s.seoTitle || s.schoolName || "Cổng thông tin nhà trường"
        : kind === "about"
          ? "Giới thiệu"
          : kind === "contact"
            ? "Liên hệ"
            : "Tìm kiếm");
  const description =
    item?.data.seoDescription ||
    item?.excerpt ||
    s.seoDescription ||
    s.slogan ||
    "";
  const origin = p.origin;
  return (
    <PublicLayout s={s} menu={menu}>
      <Head>
        <title>
          {title}
          {kind !== "home" && s.schoolName ? " | " + s.schoolName : ""}
        </title>
        <meta name="description" content={description} />
        <link rel="icon" href={s.favicon || "/favicon.svg"} />
        <link
          rel="canonical"
          href={item?.data.canonical || origin + p.pathname}
        />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content={item ? "article" : "website"} />
        <meta property="og:url" content={origin + p.pathname} />
        {item && (item.data.ogImage || item.cover) && (
          <meta
            property="og:image"
            content={new URL(item.data.ogImage || item.cover, origin).href}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              item
                ? {
                    "@context": "https://schema.org",
                    "@type":
                      type === "posts"
                        ? "Article"
                        : type === "events"
                          ? "Event"
                          : "CreativeWork",
                    name: item.title,
                    headline: item.title,
                    datePublished: item.published_at,
                    description: item.excerpt,
                    url: origin + p.pathname,
                    ...(type === "events"
                      ? {
                          startDate: item.data.start,
                          endDate: item.data.end,
                          location: {
                            "@type": "Place",
                            name: item.data.location || s.schoolName,
                          },
                        }
                      : {}),
                  }
                : {
                    "@context": "https://schema.org",
                    "@type": "School",
                    name: s.schoolName || "Tên trường",
                    url: origin,
                    ...(s.address ? { address: s.address } : {}),
                    ...(s.phone ? { telephone: s.phone } : {}),
                  },
            ).replace(/</g, "\\u003c"),
          }}
        />
      </Head>
      {kind === "home" && <Home s={s} lists={lists} />}{" "}
      {kind === "list" && (
        <ListPage
          type={type}
          rows={rows}
          total={total}
          page={page}
          query={search}
          categories={categories}
        />
      )}{" "}
      {kind === "detail" && (
        <Detail item={item} type={type} related={related} />
      )}{" "}
      {kind === "about" && <About s={s} teachers={teachers} />}{" "}
      {kind === "contact" && <Contact s={s} />}{" "}
      {kind === "search" && (
        <>
          <PageTitle title="Tìm kiếm" />
          <section className="container section">
            <form className="filters">
              <input
                name="q"
                placeholder="Nhập từ khóa…"
                aria-label="Từ khóa"
                defaultValue={search.q}
              />
              <button className="button">Tìm kiếm</button>
            </form>
            {rows.length ? (
              <div className="card-grid">
                {rows.map((x: any) => (
                  <Card key={x.id} item={x} type={x.type} />
                ))}
              </div>
            ) : (
              <div className="empty-public">
                <p>
                  {search.q
                    ? "Không tìm thấy nội dung phù hợp."
                    : "Nhập từ khóa để tìm thông tin nhà trường."}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </PublicLayout>
  );
}
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const path = (ctx.params?.path as string[]) || [];
  const [s, menu] = await Promise.all([settings(), menus()]);
  const base: any = {
    s,
    menu,
    origin:
      s.canonicalUrl ||
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000",
    pathname: "/" + path.join("/"),
    search: ctx.query,
  };
  if (path.length === 0) {
    const lists: any = {};
    await Promise.all(
      (
        ["posts", "announcements", "events", "albums", "videos"] as Resource[]
      ).map(async (t) => (lists[t] = (await publicList(t)).rows)),
    );
    return {
      props: JSON.parse(JSON.stringify({ ...base, kind: "home", lists })),
    };
  }
  if (path[0] === "gioi-thieu" && path.length === 1)
    return {
      props: JSON.parse(
        JSON.stringify({
          ...base,
          kind: "about",
          teachers: (await publicList("teachers", { all: true })).rows,
        }),
      ),
    };
  if (path[0] === "lien-he" && path.length === 1)
    return { props: { ...base, kind: "contact" } };
  if (path[0] === "tim-kiem" && path.length === 1) {
    const rows: any[] = [];
    if (typeof ctx.query.q === "string" && ctx.query.q.trim())
      await Promise.all(
        (["posts", "announcements", "events", "pages"] as Resource[]).map(
          async (t) => {
            const r = await publicList(t, { q: ctx.query.q as string });
            rows.push(...r.rows.map((x) => ({ ...x, type: t })));
          },
        ),
      );
    return {
      props: JSON.parse(JSON.stringify({ ...base, kind: "search", rows })),
    };
  }
  const type = (Object.keys(resources) as Resource[]).find(
    (t) => resources[t].route === path[0],
  );
  if (!type || type === "categories" || path.length > 2)
    return { notFound: true };
  if (path[1]) {
    const item = await publicRecord(type, path[1]);
    if (!item) return { notFound: true };
    await query(`UPDATE ${type} SET views=views+1 WHERE id=$1`, [item.id]);
    const related = (
      await publicList(type, { category: item.category_id || undefined })
    ).rows
      .filter((x) => x.id !== item.id)
      .slice(0, 3);
    return {
      props: JSON.parse(
        JSON.stringify({ ...base, kind: "detail", type, item, related }),
      ),
    };
  }
  const page = Math.max(
    1,
    Math.min(10000, parseInt(String(ctx.query.page || 1)) || 1),
  );
  const category =
    typeof ctx.query.category === "string" &&
    /^[a-f0-9-]{36}$/.test(ctx.query.category)
      ? ctx.query.category
      : undefined;
  const list = await publicList(type, {
    q: typeof ctx.query.q === "string" ? ctx.query.q.slice(0, 200) : undefined,
    category,
    page,
    sort: String(ctx.query.sort || "newest"),
  });
  return {
    props: JSON.parse(
      JSON.stringify({
        ...base,
        kind: "list",
        type,
        rows: list.rows,
        total: list.total,
        page,
        categories: (await publicList("categories", { all: true })).rows,
      }),
    ),
  };
};
