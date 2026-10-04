import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  FileText,
  Folder,
  Megaphone,
  CalendarDays,
  Images,
  Video,
  Image as ImageIcon,
  Users,
  PanelsTopLeft,
  Menu,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  History,
  LogOut,
  ArrowUpRight,
  Plus,
  ArrowRight,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import { currentUser } from "@/lib/security";
import { settings } from "@/lib/content";
import {
  User,
  Settings as SiteSettingsType,
  resources,
  Resource,
} from "@/lib/models";
import { api } from "@/lib/client";
import ContentManager from "@/components/ContentManager";
import AccountSettings from "@/components/AccountSettings";
import MediaLibrary from "@/components/MediaLibrary";
import {
  SiteSettings,
  MenuManager,
  UsersManager,
  Inbox,
  AuditLog,
} from "@/components/AdminSettings";
const nav = [
  ["Tổng quan", "", LayoutDashboard],
  ["Bài viết", "posts", FileText],
  ["Chuyên mục", "categories", Folder],
  ["Thông báo", "announcements", Megaphone],
  ["Sự kiện", "events", CalendarDays],
  ["Album ảnh", "albums", Images],
  ["Video", "videos", Video],
  ["Media", "media", ImageIcon],
  ["Ban Giám hiệu", "board", GraduationCap],
  ["Giáo viên", "teachers", Users],
  ["Trang", "pages", PanelsTopLeft],
  ["Menu", "menus", Menu],
  ["Liên hệ", "contacts", Mail],
  ["SEO", "seo", Search],
  ["Cấu hình website", "settings", Settings],
  ["Người dùng", "users", ShieldCheck],
  ["Nhật ký", "logs", History],
  ["Tài khoản của tôi", "account", ShieldCheck],
] as const;
function AuthScreen({ setup, s }: { setup: boolean; s: SiteSettingsType }) {
  const router = useRouter();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [available, setAvailable] = useState(true);
  useEffect(() => {
    api("auth/setup")
      .then((x) => setAvailable(x.available))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      await api(setup ? "auth/setup" : "auth/login", "POST", b);
      await router.push("/admin");
      router.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <Head>
        <title>{setup ? "Thiết lập quản trị" : "Đăng nhập quản trị"}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="auth-story">
        <Link href="/" className="auth-brand">
          {s.logo ? (
            <img
              className="school-logo"
              src={s.logo}
              alt="Logo trường Đinh Tiên Hoàng"
            />
          ) : (
            <span className="brand-mark">
              <BookOpen />
            </span>
          )}
          {s.schoolName || "Cổng thông tin nhà trường"}
        </Link>
        <div>
          <span className="eyebrow">KHÔNG GIAN QUẢN TRỊ</span>
          <h1>
            Kết nối tri thức.
            <br />
            Lan tỏa giá trị.
          </h1>
          <p>
            Quản lý thông tin và chia sẻ những câu chuyện của nhà trường từ một
            nơi.
          </p>
          <div className="auth-art">
            <BookOpen size={150} strokeWidth={1} />
            <span>✦</span>
          </div>
        </div>
        <small>Tri thức · Nhân cách · Tương lai</small>
      </div>
      <div className="auth-form-wrap">
        <Link className="back-link" href="/">
          ← Về website
        </Link>
        <form className="auth-form" onSubmit={submit}>
          <span className="brand-mark">
            <ShieldCheck size={28} />
          </span>
          <h2>{setup ? "Thiết lập đầu tiên" : "Quản trị website"}</h2>
          <p>
            {setup
              ? "Tạo tài khoản Super Admin của nhà trường."
              : "Đăng nhập để quản lý nội dung nhà trường."}
          </p>
          {setup && !available ? (
            <>
              <p role="status">Website đã có Super Admin.</p>
              <Link className="button full" href="/admin/login">
                Đăng nhập
              </Link>
            </>
          ) : (
            <>
              {setup && (
                <label>
                  Họ và tên
                  <input
                    name="name"
                    minLength={2}
                    maxLength={100}
                    required
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                {setup ? "Email" : "Tên đăng nhập hoặc email"}
                <input
                  name="email"
                  type={setup ? "email" : "text"}
                  required
                  autoComplete="username"
                  placeholder={setup ? "Email của bạn" : "Nhập tên đăng nhập"}
                />
              </label>
              <label>
                Mật khẩu
                <div className="password-input">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    required
                    minLength={setup ? 12 : 1}
                    maxLength={200}
                    autoComplete={setup ? "new-password" : "current-password"}
                    placeholder={setup ? "Ít nhất 12 ký tự" : "Nhập mật khẩu"}
                  />
                  <button
                    type="button"
                    aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {setup && (
                <label>
                  Mã thiết lập
                  <input
                    name="token"
                    required
                    autoComplete="off"
                    placeholder="SETUP_TOKEN trong tệp .env"
                  />
                  <small>
                    Mã riêng được tạo trên máy chủ, chỉ sử dụng lần đầu.
                  </small>
                </label>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button disabled={busy} className="button full">
                {busy ? "Đang xử lý…" : setup ? "Tạo Super Admin" : "Đăng nhập"}
                <ArrowRight size={18} />
              </button>
              {!setup && available && (
                <p className="setup-link">
                  Lần đầu sử dụng?{" "}
                  <Link href="/admin/setup">Thiết lập quản trị</Link>
                </p>
              )}
            </>
          )}
        </form>
        <small className="auth-footer">
          Chỉ dành cho người được cấp quyền quản trị.
        </small>
      </div>
    </div>
  );
}
function Dashboard({
  user,
  s,
  notify,
}: {
  user: User;
  s: SiteSettingsType;
  notify: (s: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api("admin/dashboard")
      .then((x) => setCounts(x.counts))
      .catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="eyebrow dark">KHÔNG GIAN QUẢN TRỊ</span>
          <h1>
            Xin chào, {user.name} <span className="wave">☀</span>
          </h1>
          <p className="muted">
            Cùng cập nhật những thông tin mới của nhà trường.
          </p>
        </div>
        <span className="date-chip">
          {new Date().toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</span>
          <h2>
            Câu chuyện của trường
            <br />
            bắt đầu từ bạn.
          </h2>
          <p>
            Chia sẻ tin tức, hoạt động và những khoảnh khắc
            <br className="desktop-only" /> đáng nhớ với cộng đồng nhà trường.
          </p>
          <Link className="button white" href="/admin/posts/new">
            <Plus size={18} />
            {counts?.posts === 0 ? "TẠO BÀI VIẾT ĐẦU TIÊN" : "TẠO BÀI VIẾT"}
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div />
          <BookOpen size={120} strokeWidth={1} />
          <span>✦</span>
        </div>
      </section>
      <div className="admin-stats">
        {(
          ["posts", "announcements", "events", "albums", "videos"] as Resource[]
        ).map((t, i) => {
          const Icon = [FileText, Megaphone, CalendarDays, Images, Video][i];
          return (
            <Link className="stat-card" href={"/admin/" + t} key={t}>
              <div>
                <span className="stat-icon">
                  <Icon size={22} />
                </span>
                <ArrowUpRight size={16} />
              </div>
              <strong>{counts ? counts[t] : "—"}</strong>
              <span>{resources[t].label}</span>
            </Link>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Bài viết gần đây</h2>
            <Link className="text-link" href="/admin/posts">
              Xem tất cả <ArrowRight size={15} />
            </Link>
          </div>
          {counts?.posts === 0 ? (
            <div className="admin-empty">
              <div className="empty-symbol">
                <FileText size={38} />
              </div>
              <h2>Chưa có bài viết nào</h2>
              <p>Bạn chưa đăng bài viết nào.</p>
              <Link className="button" href="/admin/posts/new">
                <Plus size={17} />
                TẠO BÀI VIẾT ĐẦU TIÊN
              </Link>
            </div>
          ) : counts ? (
            <RecentPosts notify={notify} />
          ) : (
            <div className="skeleton" style={{ height: 220 }} />
          )}
        </section>
        <section className="panel">
          <h2>Thao tác nhanh</h2>
          <p className="muted">Mọi thứ bạn cần, ngay tại đây.</p>
          <div className="quick-admin">
            {[
              ["Tạo bài viết", "posts/new", FileText],
              ["Tải hình ảnh", "media", ImageIcon],
              ["Thêm thông báo", "announcements", Megaphone],
              ["Tạo sự kiện", "events", CalendarDays],
            ]
              .filter(
                (x) =>
                  user.role !== "AUTHOR" ||
                  String(x[1]).startsWith("posts") ||
                  x[1] === "media",
              )
              .map(([label, route, Icon]: any) => (
                <Link key={route} href={"/admin/" + route}>
                  <Icon size={20} />
                  <span>{label}</span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
          </div>
          <div className="help-note">
            <ShieldCheck size={21} />
            <div>
              <strong>Dữ liệu được lưu an toàn</strong>
              <p>Nội dung được lưu vào cơ sở dữ liệu của website.</p>
            </div>
          </div>
        </section>
      </div>
      {["SUPER_ADMIN", "ADMIN"].includes(user.role) && !s.schoolName && (
        <div className="setup-notice">
          <Settings size={22} />
          <div>
            <strong>Hoàn thiện thông tin nhà trường</strong>
            <p>
              Cập nhật tên trường, logo, banner và thông tin liên hệ trước khi
              chia sẻ website.
            </p>
          </div>
          <Link className="button secondary" href="/admin/settings">
            Cấu hình <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </>
  );
}
function RecentPosts({ notify }: { notify: (s: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api("admin/posts")
      .then((x) => setRows(x.slice(0, 5)))
      .catch((e) => notify(e.message));
  }, []);
  return (
    <div>
      {rows.map((x) => (
        <Link href="/admin/posts" className="recent-row" key={x.id}>
          <FileText size={20} />
          <div>
            <strong>{x.title}</strong>
            <small>{new Date(x.created_at).toLocaleDateString("vi-VN")}</small>
          </div>
          <span className={"badge " + x.status}>
            {x.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}
          </span>
        </Link>
      ))}
    </div>
  );
}
export default function AdminPage({
  user,
  s,
  path,
}: {
  user: User | null;
  s: SiteSettingsType;
  path: string[];
}) {
  const router = useRouter();
  const tab = path[0] || "";
  const [toast, setToast] = useState(""),
    [open, setOpen] = useState(false);
  function notify(msg: string) {
    setToast(msg);
  }
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timeout);
  }, [toast]);
  if (!user) return <AuthScreen setup={tab === "setup"} s={s} />;
  const allowed = (route: string) =>
    user.role === "AUTHOR"
      ? ["", "posts", "media", "account"].includes(route)
      : user.role === "EDITOR"
        ? !["settings", "seo", "menus", "users", "logs"].includes(route)
        : user.role === "ADMIN"
          ? route !== "users"
          : true;
  return (
    <div className="admin-app">
      <Head>
        <title>Quản trị website | {s.schoolName || "Nhà trường"}</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="icon" href={s.favicon || "/favicon.svg"} />
      </Head>
      <aside className={"admin-sidebar " + (open ? "is-open" : "")}>
        <Link className="admin-brand" href="/admin">
          {s.logo ? (
            <img
              className="school-logo"
              src={s.logo}
              alt="Logo trường Đinh Tiên Hoàng"
            />
          ) : (
            <span className="brand-mark">
              <BookOpen size={23} />
            </span>
          )}
          <span>
            <strong>{s.shortName || s.schoolName || "School CMS"}</strong>
            <small>QUẢN TRỊ WEBSITE</small>
          </span>
        </Link>
        <span className="sidebar-label">KHÔNG GIAN LÀM VIỆC</span>
        <nav aria-label="Menu quản trị">
          {nav
            .filter(([, r]) => allowed(r))
            .map(([label, route, Icon]) => (
              <Link
                key={route}
                href={"/admin" + (route ? "/" + route : "")}
                className={tab === route ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                {label}
                {tab === route && <span />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" target="_blank">
            <ArrowUpRight size={17} />
            Xem website
          </Link>
          <button
            onClick={async () => {
              await api("auth/logout", "POST");
              await router.push("/admin/login");
              router.reload();
            }}
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
          <div className="sidebar-user">
            <span className="avatar">{user.name[0].toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role.replace("_", " ")}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-header">
          <div>
            <button
              className="mobile-toggle"
              aria-label="Mở menu"
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </button>
            <span>
              Quản trị <span className="breadcrumb-slash">/</span>{" "}
              <strong>
                {nav.find((x) => x[1] === tab)?.[0] || "Tổng quan"}
              </strong>
            </span>
          </div>
          <div>
            <span className="system-status">
              <span />
              Hệ thống hoạt động
            </span>
            <Link href="/" className="view-site" target="_blank">
              Xem website <ArrowUpRight size={16} />
            </Link>
            <span className="avatar">{user.name[0].toUpperCase()}</span>
          </div>
        </header>
        <main className="admin-main">
          {!allowed(tab) ? (
            <div className="panel">
              <h1>Bạn không có quyền truy cập mục này.</h1>
              <Link href="/admin">Về tổng quan</Link>
            </div>
          ) : (
            <>
              {!tab && <Dashboard user={user} s={s} notify={notify} />}{" "}
              {Object.hasOwn(resources, tab) && (
                <ContentManager
                  key={tab + path.join("/")}
                  type={tab as Resource}
                  notify={notify}
                  initialNew={path[1] === "new"}
                  authorName={user.name}
                  group={tab === "teachers" ? "TEACHER" : undefined}
                />
              )}{" "}
              {tab === "board" && (
                <ContentManager
                  key="board"
                  type="teachers"
                  group="BOARD"
                  authorName={user.name}
                  notify={notify}
                />
              )}{" "}
              {tab === "media" && <MediaLibrary notify={notify} />}{" "}
              {(tab === "settings" || tab === "seo") && (
                <SiteSettings notify={notify} seoOnly={tab === "seo"} />
              )}{" "}
              {tab === "menus" && <MenuManager notify={notify} />}{" "}
              {tab === "users" && <UsersManager notify={notify} />}{" "}
              {tab === "contacts" && <Inbox notify={notify} />}{" "}
              {tab === "logs" && <AuditLog notify={notify} />}
              {tab === "account" && <AccountSettings user={user} />}
            </>
          )}
        </main>
        <div className="admin-bottom">
          {s.schoolName || "School CMS"}
          <span>Không gian quản trị nhà trường</span>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const path = (ctx.params?.path as string[]) || [];
  const user = await currentUser(ctx.req as any);
  if (!user && !["login", "setup"].includes(path[0]))
    return { redirect: { destination: "/admin/login", permanent: false } };
  if (user && ["login", "setup"].includes(path[0]))
    return { redirect: { destination: "/admin", permanent: false } };
  if (
    path.length > 2 ||
    (path[0] &&
      !nav.some((x) => x[1] === path[0]) &&
      !["login", "setup"].includes(path[0]))
  )
    return { notFound: true };
  return { props: { user, s: await settings(), path } };
};
