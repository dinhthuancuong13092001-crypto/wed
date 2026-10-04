import { useState } from "react";
import SchoolMap from "./SchoolMap";
import Link from "next/link";
import {
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  FileText,
  Images,
  Video,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  Search,
  GraduationCap,
  School,
  Users,
  Clock,
} from "lucide-react";
import { RecordItem, Resource, resources, Settings } from "@/lib/models";
import { youtubeId } from "@/lib/validation";
const icons = {
  posts: FileText,
  announcements: FileText,
  events: CalendarDays,
  albums: Images,
  videos: Video,
  teachers: Users,
  pages: BookOpen,
  categories: BookOpen,
};
export function Empty({ type }: { type: Resource }) {
  const Icon = icons[type];
  return (
    <div className="empty-public">
      <span>
        <Icon size={28} />
      </span>
      <p>
        Hiện chưa có{" "}
        {type === "posts"
          ? "bài viết"
          : type === "albums"
            ? "album ảnh"
            : resources[type].singular}
        .
      </p>
      <small>Nội dung sẽ được cập nhật tại đây.</small>
    </div>
  );
}
export function Card({ item, type }: { item: RecordItem; type: Resource }) {
  const Icon = icons[type];
  const state =
    type === "events"
      ? Date.now() < Date.parse(item.data.start)
        ? "Sắp diễn ra"
        : Date.now() > Date.parse(item.data.end)
          ? "Đã kết thúc"
          : "Đang diễn ra"
      : null;
  return (
    <Link
      className="content-card"
      href={"/" + resources[type].route + "/" + item.slug}
    >
      <div className="card-image">
        {item.cover ? (
          <img loading="lazy" src={item.cover} alt={item.title} />
        ) : (
          <Icon size={40} />
        )}
      </div>
      <div className="card-body">
        <small>{state || item.category_name || resources[type].label}</small>
        <h3>{item.title}</h3>
        <p>{item.excerpt}</p>
        <div className="card-meta">
          <span>{new Date(item.published_at).toLocaleDateString("vi-VN")}</span>
          <ArrowUpRight size={18} />
        </div>
        {type === "posts" && (
          <small>
            {item.author_name} · {item.views} lượt xem
          </small>
        )}
      </div>
    </Link>
  );
}
export function Home({
  s,
  lists,
}: {
  s: Settings;
  lists: Record<string, RecordItem[]>;
}) {
  return (
    <>
      <section
        className={"hero " + (s.heroImage ? "has-image" : "")}
        style={
          s.heroImage
            ? {
                backgroundImage: `linear-gradient(90deg,rgba(9,33,79,.9),rgba(9,33,79,.25)),url("${s.heroImage.replace(/"/g, "")}")`,
              }
            : undefined
        }
      >
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">
              <span /> CHÀO MỪNG ĐẾN VỚI NHÀ TRƯỜNG
            </span>
            <h1>
              {s.heroTitle ||
                s.schoolName ||
                "Tri thức hôm nay.\nTương lai ngày mai."}
            </h1>
            <p>
              {s.heroText || s.slogan || "Tri thức – Nhân cách – Tương lai"}
            </p>
            <Link className="button white" href={s.heroLink || "/gioi-thieu"}>
              {s.heroButton || "Khám phá nhà trường"}
              <ArrowUpRight size={19} />
            </Link>
          </div>
          {!s.heroImage && (
            <div className="hero-art" aria-hidden="true">
              <div className="orbit one" />
              <div className="orbit two" />
              <div className="art-grid" />
              <div className="book-sculpture">
                <BookOpen strokeWidth={1} size={170} />
              </div>
              <span className="art-caption">
                HỌC TẬP · KHÁM PHÁ · TRƯỞNG THÀNH
              </span>
              <span className="spark s1">✦</span>
              <span className="spark s2">✦</span>
            </div>
          )}
        </div>
        <div className="hero-bottom container">
          <span>Không gian kết nối nhà trường & gia đình</span>
          <span>
            Khám phá <ArrowRight size={16} />
          </span>
        </div>
      </section>
      <div className="container quick-links">
        {[
          ["Thông báo", "/thong-bao", FileText],
          ["Tin tức nhà trường", "/tin-tuc", BookOpen],
          ["Lịch sự kiện", "/su-kien", CalendarDays],
          ["Liên hệ", "/lien-he", Send],
        ].map(([label, href, I]: any) => (
          <Link key={href} href={href}>
            <I size={23} />
            <strong>{label}</strong>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
      {lists.announcements?.length > 0 && (
        <section className="container section">
          <SectionTitle
            label="THÔNG TIN CẦN BIẾT"
            title="Thông báo quan trọng"
            href="/thong-bao"
          />
          <div className="notice-list">
            {lists.announcements.slice(0, 3).map((x) => (
              <Link href={"/thong-bao/" + x.slug} key={x.id}>
                <CalendarDays />
                <div>
                  <small>
                    {new Date(x.published_at).toLocaleDateString("vi-VN")}
                  </small>
                  <h3>{x.title}</h3>
                </div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="container section about-section">
        <div>
          <span className="eyebrow dark">VỀ NHÀ TRƯỜNG</span>
          <h2>
            Cùng học tập.
            <br />
            Cùng trưởng thành.
          </h2>
          <p>
            {s.about || "Thông tin giới thiệu nhà trường đang được cập nhật."}
          </p>
          <Link className="text-link" href="/gioi-thieu">
            Tìm hiểu thêm <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="values-panel">
          <span className="values-icon">
            <GraduationCap size={44} />
          </span>
          <h3>{s.slogan || "Tri thức – Nhân cách – Tương lai"}</h3>
          <p>
            {s.vision ||
              "Khám phá thông tin, đội ngũ và môi trường học tập của nhà trường."}
          </p>
          <div className="value-line">
            <span>01</span>
            <strong>Tri thức</strong>
            <span>02</span>
            <strong>Nhân cách</strong>
            <span>03</span>
            <strong>Tương lai</strong>
          </div>
        </div>
      </section>
      <section className="soft-section">
        <div className="container section">
          <SectionTitle
            label="NHỊP SỐNG HỌC ĐƯỜNG"
            title="Tin tức mới nhất"
            href="/tin-tuc"
          />
          {lists.posts?.length ? (
            <div className="card-grid">
              {lists.posts.slice(0, 3).map((x) => (
                <Card key={x.id} item={x} type="posts" />
              ))}
            </div>
          ) : (
            <Empty type="posts" />
          )}
        </div>
      </section>
      <section className="container section">
        <SectionTitle label="LỊCH NHÀ TRƯỜNG" title="Sự kiện" href="/su-kien" />
        {lists.events?.length ? (
          <div className="card-grid">
            {lists.events.slice(0, 3).map((x) => (
              <Card key={x.id} item={x} type="events" />
            ))}
          </div>
        ) : (
          <Empty type="events" />
        )}
      </section>
      {s.achievements && (
        <section className="blue-section">
          <div className="container section">
            <span className="eyebrow">DẤU ẤN NHÀ TRƯỜNG</span>
            <h2>Thành tích nổi bật</h2>
            <p>{s.achievements}</p>
          </div>
        </section>
      )}
      <section className="soft-section">
        <div className="container section">
          <SectionTitle
            label="KHOẢNH KHẮC HỌC ĐƯỜNG"
            title="Thư viện hình ảnh"
            href="/thu-vien"
          />
          {lists.albums?.length ? (
            <div className="card-grid">
              {lists.albums.slice(0, 3).map((x) => (
                <Card key={x.id} item={x} type="albums" />
              ))}
            </div>
          ) : (
            <Empty type="albums" />
          )}
        </div>
      </section>
      <section className="container section">
        <SectionTitle label="GÓC NHÌN NHÀ TRƯỜNG" title="Video" href="/video" />
        {lists.videos?.length ? (
          <div className="card-grid">
            {lists.videos.slice(0, 3).map((x) => (
              <Card key={x.id} item={x} type="videos" />
            ))}
          </div>
        ) : (
          <Empty type="videos" />
        )}
      </section>
      {[s.students, s.teacherCount, s.classrooms, s.years].some(Boolean) && (
        <div className="container stats-school">
          {[
            ["Học sinh", s.students, Users],
            ["Giáo viên", s.teacherCount, GraduationCap],
            ["Phòng học", s.classrooms, School],
            ["Năm hình thành", s.years, Clock],
          ]
            .filter((x) => x[1])
            .map(([l, n, I]: any) => (
              <div key={l}>
                <I />
                <strong>{n}</strong>
                <span>{l}</span>
              </div>
            ))}
        </div>
      )}
      <section className="container contact-banner">
        <div>
          <span className="eyebrow dark">KẾT NỐI VỚI CHÚNG TÔI</span>
          <h2>Nhà trường luôn lắng nghe.</h2>
          <p>Gửi câu hỏi và thông tin cần trao đổi đến nhà trường.</p>
        </div>
        <Link className="button" href="/lien-he">
          Liên hệ nhà trường <ArrowUpRight size={19} />
        </Link>
      </section>
    </>
  );
}
export function SectionTitle({
  label,
  title,
  href,
}: {
  label: string;
  title: string;
  href: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow dark">{label}</span>
        <h2>{title}</h2>
      </div>
      <Link className="text-link" href={href}>
        Xem tất cả <ArrowRight size={18} />
      </Link>
    </div>
  );
}
export function ListPage({
  type,
  rows,
  total,
  page,
  query,
  categories,
}: {
  type: Resource;
  rows: RecordItem[];
  total: number;
  page: number;
  query: any;
  categories: RecordItem[];
}) {
  return (
    <>
      <PageTitle title={resources[type].label} />
      <section className="container section">
        <form className="filters">
          <div className="search-field">
            <Search size={18} />
            <input
              name="q"
              aria-label="Tìm nội dung"
              placeholder="Tìm kiếm nội dung…"
              defaultValue={query.q}
            />
          </div>
          {type === "posts" && (
            <select
              name="category"
              aria-label="Chuyên mục"
              defaultValue={query.category || ""}
            >
              <option value="">Tất cả chuyên mục</option>
              {categories.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          )}
          <select
            name="sort"
            aria-label="Sắp xếp"
            defaultValue={query.sort || "newest"}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="featured">Nổi bật</option>
          </select>
          <button className="button">Tìm kiếm</button>
        </form>
        {rows.length ? (
          <>
            <p className="muted">{total} kết quả</p>
            <div className="card-grid">
              {rows.map((x) => (
                <Card key={x.id} item={x} type={type} />
              ))}
            </div>
          </>
        ) : (
          <Empty type={type} />
        )}
        <div className="pagination">
          {page > 1 && (
            <Link href={{ query: { ...query, page: page - 1 } }}>
              ← Trang trước
            </Link>
          )}
          {total > 12 && (
            <span>
              Trang {page} / {Math.ceil(total / 12)}
            </span>
          )}
          {page * 12 < total && (
            <Link href={{ query: { ...query, page: page + 1 } }}>
              Trang sau →
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
export function PageTitle({ title }: { title: string }) {
  return (
    <section className="page-title">
      <div className="container">
        <p>
          <Link href="/">Trang chủ</Link> / {title}
        </p>
        <h1>{title}</h1>
      </div>
    </section>
  );
}
export function Detail({
  item,
  type,
  related = [],
}: {
  item: RecordItem;
  type: Resource;
  related?: RecordItem[];
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const images = Array.isArray(item.data.images) ? item.data.images : [];
  const vid = type === "videos" ? youtubeId(item.data.youtube || "") : null;
  return (
    <section className="container section">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link> /{" "}
        <Link href={"/" + resources[type].route}>{resources[type].label}</Link>{" "}
        / {item.title}
      </div>
      <article className="article">
        <span className="eyebrow dark">
          {item.category_name || resources[type].label}
        </span>
        <h1>{item.title}</h1>
        <p className="article-meta">
          {new Date(item.published_at).toLocaleDateString("vi-VN")} ·{" "}
          {item.author_name} · {item.views} lượt xem
        </p>
        {item.excerpt && <p className="article-lead">{item.excerpt}</p>}
        {item.cover && (
          <img className="article-cover" src={item.cover} alt={item.title} />
        )}{" "}
        {type === "events" && (
          <div className="event-info">
            <CalendarDays /> {new Date(item.data.start).toLocaleString("vi-VN")}{" "}
            — {new Date(item.data.end).toLocaleString("vi-VN")}
            <p>Địa điểm: {item.data.location}</p>
          </div>
        )}
        {vid && (
          <iframe
            className="video-embed"
            src={"https://www.youtube-nocookie.com/embed/" + vid}
            title={item.title}
            allowFullScreen
          />
        )}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
        {item.data.attachment && (
          <a
            className="button secondary"
            href={item.data.attachment}
            target="_blank"
            rel="noopener noreferrer"
          >
            Xem tài liệu đính kèm ↗
          </a>
        )}
        {type === "albums" && (
          <div className="gallery">
            {images.map((u: string, i: number) => (
              <button
                key={i}
                onClick={() => setLightbox(i)}
                aria-label={"Xem ảnh " + (i + 1)}
              >
                <img
                  loading="lazy"
                  src={u}
                  alt={item.title + " – ảnh " + (i + 1)}
                />
              </button>
            ))}
          </div>
        )}
        <div className="share">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
            }}
          >
            {copied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
          </button>
          <button onClick={() => window.print()}>In nội dung</button>
        </div>
      </article>
      {related.length > 0 && (
        <>
          <h2>Nội dung liên quan</h2>
          <div className="card-grid">
            {related.map((x) => (
              <Card key={x.id} item={x} type={type} />
            ))}
          </div>
        </>
      )}
      {lightbox !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh"
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(null);
            if (e.key === "ArrowRight")
              setLightbox((lightbox + 1) % images.length);
            if (e.key === "ArrowLeft")
              setLightbox((lightbox - 1 + images.length) % images.length);
          }}
        >
          <button
            autoFocus
            className="lightbox-close"
            aria-label="Đóng"
            onClick={() => setLightbox(null)}
          >
            <X />
          </button>
          <button
            aria-label="Ảnh trước"
            onClick={() =>
              setLightbox((lightbox - 1 + images.length) % images.length)
            }
          >
            <ChevronLeft />
          </button>
          <img src={images[lightbox]} alt={item.title} />
          <button
            aria-label="Ảnh sau"
            onClick={() => setLightbox((lightbox + 1) % images.length)}
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </section>
  );
}
export function About({
  s,
  teachers,
}: {
  s: Settings;
  teachers: RecordItem[];
}) {
  const fields = [
    ["Giới thiệu chung", "about"],
    ["Lịch sử hình thành", "history"],
    ["Tầm nhìn", "vision"],
    ["Sứ mệnh", "mission"],
    ["Giá trị cốt lõi", "values"],
    ["Cơ cấu tổ chức", "organization"],
    ["Cơ sở vật chất", "facilities"],
    ["Thành tích", "achievements"],
  ];
  return (
    <>
      <PageTitle title="Giới thiệu nhà trường" />
      <section className="container section about-detail">
        <aside>
          {fields.map(([label, key]) => (
            <a href={"#" + key} key={key}>
              {label}
            </a>
          ))}
          <a href="#doi-ngu">Đội ngũ nhà trường</a>
        </aside>
        <div>
          {fields
            .filter(([, key]) => s[key])
            .map(([label, key]) => (
              <section id={key} key={key}>
                <h2>{label}</h2>
                <p className="preserve-lines">{s[key]}</p>
              </section>
            ))}
          {!fields.some(([, key]) => s[key]) && (
            <div className="empty-public">
              <BookOpen />
              <p>Thông tin giới thiệu đang được cập nhật.</p>
            </div>
          )}
          <section id="doi-ngu">
            <h2>Đội ngũ nhà trường</h2>
            {teachers.length ? (
              <div className="teacher-grid">
                {teachers
                  .sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
                  .map((x) => (
                    <div className="teacher-card" key={x.id}>
                      {x.cover && <img src={x.cover} alt={x.title} />}
                      <h3>{x.title}</h3>
                      <span>{x.data.position}</span>
                      <p>{x.data.department}</p>
                      <p>{x.excerpt}</p>
                      {x.data.email && (
                        <a href={"mailto:" + x.data.email}>{x.data.email}</a>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="muted">Thông tin đội ngũ đang được cập nhật.</p>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
export function Contact({ s }: { s: Settings }) {
  return (
    <>
      <PageTitle title="Liên hệ" />
      <section className="container section contact-details">
        <div>
          <span className="eyebrow dark">THÔNG TIN NHÀ TRƯỜNG</span>
          <h2>{s.schoolName || "Tên trường"}</h2>
          {[
            ["Địa chỉ", s.address],
            ["Điện thoại", s.phone],
            ["Email", s.email],
            ["Website", s.website],
          ]
            .filter((x) => x[1])
            .map(([l, v]) => (
              <div className="contact-info" key={l}>
                <small>{l}</small>
                <p>{v}</p>
              </div>
            ))}
          {s.maps && (
            <a
              className="text-link"
              target="_blank"
              rel="noopener noreferrer"
              href={s.maps}
            >
              Xem trên Google Maps ↗
            </a>
          )}
          {!s.address && !s.phone && !s.email && (
            <p className="muted">Thông tin liên hệ đang được cập nhật.</p>
          )}
          <SchoolMap s={s} />
        </div>

      </section>
    </>
  );
}

