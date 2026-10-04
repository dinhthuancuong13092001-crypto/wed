import Link from "next/link";
import SchoolMap from "./SchoolMap";
import { useState } from "react";
import {
  BookOpen,
  Menu,
  X,
  Search,
  ArrowUpRight,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { Settings, defaultMenu } from "@/lib/models";
export function Brand({ s }: { s: Settings }) {
  return (
    <Link className="brand" href="/">
      {s.logo ? (
        <img src={s.logo} alt="Logo trường" />
      ) : (
        <span className="brand-mark">
          <BookOpen size={25} />
        </span>
      )}
      <span>
        <strong>{s.schoolName || "Tên trường"}</strong>
        <small>{s.slogan || "Tri thức · Nhân cách · Tương lai"}</small>
      </span>
    </Link>
  );
}
export default function PublicLayout({
  s,
  menu = [],
  children,
}: {
  s: Settings;
  menu?: any[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const links = (menu.length
    ? menu
    : defaultMenu.map(([label, url], i) => ({ id: String(i), label, url })))
    .filter((item) => !["/thong-bao", "/video"].includes(item.url.replace(/\/$/, "")));
  return (
    <div
      className="public-site"
      style={
        s.primaryColor
          ? ({ "--blue": s.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <header className="site-header">
        <div className="container header-inner">
          <Brand s={s} />
          <button
            className="mobile-toggle"
            aria-label="Mở menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            className={open ? "nav open" : "nav"}
            aria-label="Điều hướng chính"
          >
            {links
              .filter((x) => !x.parent_id)
              .map((x) => (
                <div className="nav-item" key={x.id}>
                  <Link onClick={() => setOpen(false)} href={x.url}>
                    {x.label}
                  </Link>
                  {links.filter((y) => y.parent_id === x.id).length > 0 && (
                    <div className="submenu">
                      {links
                        .filter((y) => y.parent_id === x.id)
                        .map((y) => (
                          <Link key={y.id} href={y.url}>
                            {y.label}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            <Link href="/tim-kiem" aria-label="Tìm kiếm">
              <Search size={20} />
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer>
        <div className="container footer-grid">
          <div>
            <Brand s={s} />
            <p>{s.footer || s.slogan || "Tri thức – Nhân cách – Tương lai"}</p>
          </div>
          <div>
            <h3>Khám phá</h3>
            <Link href="/gioi-thieu">Giới thiệu nhà trường</Link>
            <Link href="/tin-tuc">Tin tức & hoạt động</Link>
            <Link href="/thu-vien">Thư viện hình ảnh</Link>
          </div>
          <div>
            <h3>Kết nối</h3>
            <Link href="/thong-bao">Thông báo</Link>
            <Link href="/su-kien">Sự kiện</Link>
            <Link href="/lien-he">Liên hệ nhà trường</Link>
            {[
              ["Facebook", s.facebook],
              ["YouTube", s.youtube],
              ["TikTok", s.tiktok],
            ]
              .filter((x) => x[1])
              .map(([label, u]) => (
                <a
                  key={label}
                  href={u}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {label} ↗
                </a>
              ))}
          </div>
          <div>
            <h3>Thông tin liên hệ</h3>
            {s.address && (
              <p>
                <MapPin size={16} />
                {s.address}
              </p>
            )}
            {s.phone && (
              <a href={"tel:" + s.phone}>
                <Phone size={16} />
                {s.phone}
              </a>
            )}
            {s.email && (
              <a href={"mailto:" + s.email}>
                <Mail size={16} />
                {s.email}
              </a>
            )}
            {!s.address && !s.phone && !s.email && (
              <p>Thông tin đang được cập nhật.</p>
            )}
              <SchoolMap s={s} />
          </div>
        </div>
        <div className="container copyright">
          Copyright © {new Date().getFullYear()} {s.schoolName || "Tên trường"}.
        </div>
      </footer>
    </div>
  );
}
