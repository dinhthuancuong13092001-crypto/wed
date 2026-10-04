import { useEffect, useState } from "react";
import {
  Save,
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  Mail,
} from "lucide-react";
import { settingFields, defaultMenu, User } from "@/lib/models";
import { api } from "@/lib/client";
import MediaLibrary from "./MediaLibrary";
type Props = { notify: (message: string) => void };
export function SiteSettings({
  notify,
  seoOnly = false,
}: { seoOnly?: boolean } & Props) {
  const [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api("admin/settings")
      .then((v) => {
        setValues(v);
        setSaved(v);
        setLoaded(true);
      })
      .catch((e) => notify(e.message));
  }, []);
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState<Record<string, string>>({});
  useEffect(() => setActive(0), [seoOnly]);
  const groups = seoOnly
    ? [["SEO & tên miền", ["seoTitle", "seoDescription", "canonicalUrl"]]]
    : [
        [
          "Thông tin trường",
          [
            "schoolName",
            "shortName",
            "slogan",
          ],
        ],
        ["Logo & màu sắc", ["logo", "favicon", "primaryColor"]],
        [
          "Banner trang chủ",
          ["heroTitle", "heroText", "heroImage", "heroButton", "heroLink"],
        ],
        [
          "Giới thiệu nhà trường",
          [
            "about",
            "history",
            "vision",
            "mission",
            "values",
            "organization",
            "facilities",
            "achievements",
          ],
        ],
        ["Thống kê", ["students", "teacherCount", "classrooms", "years"]],
        [
          "Thông tin liên hệ",
          [
            "address",
            "phone",
            "email",
            "website",
            "facebook",
            "youtube",
            "tiktok",
            "maps",
            "mapsEmbed",
            "footer",
          ],
        ],
        ["SEO & tên miền", ["seoTitle", "seoDescription", "canonicalUrl"]],
      ];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const changes = Object.fromEntries((groups[active][1] as string[]).map((k) => [k, values[k] || ""]));
      await api("admin/settings", "PUT", changes);
      setSaved((previous) => ({ ...previous, ...changes }));
      notify(`Đã lưu mục ${groups[active][0]}.`);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel-heading">
        <div>
          <h1>{seoOnly ? "SEO" : "Cấu hình website"}</h1>
          <p className="muted">
            Chọn mục cần chỉnh sửa, thay đổi nội dung rồi bấm Lưu mục này.
          </p>
        </div>
      </div>
      {!loaded ? (
        <div className="skeleton" style={{ height: 400 }} />
      ) : (
        <div className="settings-workspace">
          {!seoOnly && <nav className="settings-menu" aria-label="Các mục cấu hình website">
            {groups.map(([title, keys], index) => <button key={title as string} type="button" disabled={busy}
              aria-current={active === index ? "page" : undefined} onClick={() => setActive(index)}>
              <span>{index + 1}. {title}</span>
              {(keys as string[]).some((k) => (values[k] || "") !== (saved[k] || "")) && <span className="settings-draft" aria-label="Có thay đổi chưa lưu">●</span>}
            </button>)}
          </nav>}
        <form onSubmit={save} className="settings-content">
          <div>
            {groups.filter((_, index) => index === active).map(([title, keys]) => (
              <section className="panel" key={title as string}>
                <h2>{title}</h2>
                <div className="form-grid">
                  {(keys as string[]).map((k) => (
                    <label key={k}>
                      {settingFields[k as keyof typeof settingFields]}
                      {[
                        "about",
                        "history",
                        "vision",
                        "mission",
                        "values",
                        "organization",
                        "facilities",
                        "achievements",
                        "heroText",
                        "footer",
                        "seoDescription",
                      ].includes(k) ? (
                        <textarea
                          rows={4}
                          value={values[k] || ""}
                          onChange={(e) =>
                            setValues({ ...values, [k]: k === "mapsEmbed" ? (e.target.value.match(/src=["']([^"']+)["']/i)?.[1] || e.target.value).trim() : e.target.value })
                          }
                        />
                      ) : (
                        <input
                          value={values[k] || ""}
                          placeholder={
                            k === "schoolName"
                              ? "Nhập tên trường của bạn"
                              : k === "primaryColor"
                                ? "#1559dc"
                                : undefined
                          }
                          onChange={(e) =>
                            setValues({ ...values, [k]: k === "mapsEmbed" ? (e.target.value.match(/src=["']([^"']+)["']/i)?.[1] || e.target.value).trim() : e.target.value })
                          }
                        />
                      )}{" "}
                      {k === "maps" && <small className="muted">Dán liên kết từ Google Maps → Chia sẻ → Sao chép liên kết.</small>}
                      {k === "mapsEmbed" && <small className="muted">Để ghim đúng vị trí: Google Maps → Chia sẻ → Nhúng bản đồ. Dán liên kết nhúng vào đây. Nếu để trống, bản đồ dùng địa chỉ trường đã nhập.</small>}
                      {["logo", "favicon", "heroImage"].includes(k) && (
                        <>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => setPicker(k)}
                          >
                            <ImageIcon size={15} />
                            Chọn ảnh
                          </button>
                          {values[k] && (
                            <img
                              className="settings-image"
                              src={values[k]}
                              alt={
                                settingFields[k as keyof typeof settingFields]
                              }
                            />
                          )}
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="settings-save">
            <span className="muted">Chỉ lưu thông tin của mục đang mở.</span>
            <button disabled={busy} className="button">
              <Save size={17} />
              {busy ? "Đang lưu…" : "Lưu mục này"}
            </button>
          </div>
        </form>
        </div>
      )}
      {picker && (
        <MediaLibrary
          notify={notify}
          onClose={() => setPicker("")}
          select={(u) => {
            setValues({ ...values, [picker]: u });
            setPicker("");
          }}
        />
      )}
    </>
  );
}
export function MenuManager({ notify }: Props) {
  const [items, setItems] = useState<any[]>([]),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api("admin/menus")
      .then((v) => {
        setItems(
          v.length
            ? v
            : defaultMenu.map(([label, url], i) => ({
                id: "new-" + i,
                label,
                url,
                visible: true,
                parent_id: null,
              })),
        );
        setLoaded(true);
      })
      .catch((e) => notify(e.message));
  }, []);
  function move(i: number, d: number) {
    const next = [...items];
    if (i + d < 0 || i + d >= items.length) return;
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setItems(next);
  }
  return (
    <>
      <div className="panel-heading">
        <div>
          <h1>Quản lý menu</h1>
          <p className="muted">Chỉnh sửa liên kết và thứ tự điều hướng.</p>
        </div>
        <button
          className="button"
          onClick={() =>
            setItems([
              ...items,
              {
                id: "new-" + Date.now(),
                label: "Liên kết mới",
                url: "/",
                visible: true,
                parent_id: null,
              },
            ])
          }
        >
          <Plus size={17} />
          Thêm liên kết
        </button>
      </div>
      <div className="panel">
        {loaded &&
          items.map((item, i) => (
            <div className="menu-editor-row" key={item.id}>
              <span>{i + 1}</span>
              <label>
                Tên liên kết
                <input
                  value={item.label}
                  onChange={(e) =>
                    setItems(
                      items.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                URL
                <input
                  value={item.url}
                  onChange={(e) =>
                    setItems(
                      items.map((x, j) =>
                        j === i ? { ...x, url: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Menu cha
                <select
                  value={item.parent_id || ""}
                  onChange={(e) =>
                    setItems(
                      items.map((x, j) =>
                        j === i
                          ? { ...x, parent_id: e.target.value || null }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="">Không có</option>
                  {items
                    .filter((x) => x.id !== item.id && !x.parent_id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={(e) =>
                    setItems(
                      items.map((x, j) =>
                        j === i ? { ...x, visible: e.target.checked } : x,
                      ),
                    )
                  }
                />
                Hiện
              </label>
              <div className="row-actions">
                <button aria-label="Lên" onClick={() => move(i, -1)}>
                  <ArrowUp size={16} />
                </button>
                <button aria-label="Xuống" onClick={() => move(i, 1)}>
                  <ArrowDown size={16} />
                </button>
                <button
                  aria-label="Gỡ liên kết"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        <button
          className="button"
          onClick={async () => {
            try {
              await api("admin/menus", "PUT", items);
              notify("Đã lưu menu.");
            } catch (e: any) {
              notify(e.message);
            }
          }}
        >
          <Save size={17} />
          Lưu menu
        </button>
      </div>
    </>
  );
}
export function UsersManager({ notify }: Props) {
  const [rows, setRows] = useState<any[]>([]),
    [edit, setEdit] = useState<any>(null);
  async function load() {
    try {
      setRows(await api("admin/users"));
    } catch (e: any) {
      notify(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const b = { ...edit };
      if (!b.password) delete b.password;
      await api(
        "admin/users" + (edit.id ? "/" + edit.id : ""),
        edit.id ? "PUT" : "POST",
        b,
      );
      setEdit(null);
      await load();
      notify(
        "Đã lưu tài khoản. Phiên đăng nhập cũ của tài khoản đã được thu hồi.",
      );
    } catch (e: any) {
      notify(e.message);
    }
  }
  return (
    <>
      <div className="panel-heading">
        <div>
          <h1>Người dùng</h1>
          <p className="muted">Quản lý tài khoản và quyền truy cập.</p>
        </div>
        <button
          className="button"
          onClick={() =>
            setEdit({
              name: "",
              email: "",
              password: "",
              role: "AUTHOR",
              active: true,
            })
          }
        >
          <Plus size={17} />
          Thêm người dùng
        </button>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Tên đăng nhập / Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td>{x.email}</td>
                <td>
                  <span className="badge">{x.role}</span>
                </td>
                <td>{x.active ? "Hoạt động" : "Đã khóa"}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label="Sửa tài khoản"
                    onClick={() => setEdit({ ...x, password: "" })}
                  >
                    <Pencil size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={save}
            role="dialog"
            aria-modal="true"
          >
            <h2>{edit.id ? "Sửa tài khoản" : "Thêm người dùng"}</h2>
            <label>
              Họ tên
              <input
                required
                minLength={2}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            <label>
              Tên đăng nhập hoặc email
              <input
                required
                type="text"
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </label>
            <label>
              {edit.id ? "Mật khẩu mới (để trống để giữ nguyên)" : "Mật khẩu"}
              <input
                type="password"
                minLength={12}
                required={!edit.id}
                value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              />
            </label>
            <label>
              Vai trò
              <select
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value })}
              >
                {["SUPER_ADMIN", "ADMIN", "EDITOR", "AUTHOR"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />
              Hoạt động
            </label>
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEdit(null)}
              >
                Hủy
              </button>
              <button className="button">Lưu tài khoản</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
export function Inbox({ notify }: Props) {
  const [rows, setRows] = useState<any[]>([]),
    [active, setActive] = useState<any>(null);
  useEffect(() => {
    api("admin/contacts")
      .then(setRows)
      .catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="panel-heading">
        <div>
          <h1>Liên hệ</h1>
          <p className="muted">
            Lời nhắn từ phụ huynh, học sinh và khách truy cập.
          </p>
        </div>
      </div>
      <div className="panel">
        {!rows.length ? (
          <div className="admin-empty">
            <Mail size={40} />
            <h2>Chưa có liên hệ</h2>
            <p>Lời nhắn mới sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          rows.map((x) => (
            <button
              className="inbox-row"
              key={x.id}
              onClick={async () => {
                try {
                  await api("admin/contacts/" + x.id, "PUT", {
                    status: "READ",
                  });
                  setActive(x);
                  setRows(
                    rows.map((r) =>
                      r.id === x.id ? { ...r, status: "READ" } : r,
                    ),
                  );
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              <span
                className={
                  "badge " + (x.status === "UNREAD" ? "PUBLISHED" : "")
                }
              >
                {x.status === "UNREAD" ? "Mới" : "Đã đọc"}
              </span>
              <strong>{x.subject}</strong>
              <span>{x.name}</span>
              <small>
                {new Date(x.created_at).toLocaleDateString("vi-VN")}
              </small>
            </button>
          ))
        )}
      </div>
      {active && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>{active.subject}</h2>
            <p>
              {active.name} · {active.email} · {active.phone}
            </p>
            <p className="preserve-lines">{active.message}</p>
            <button
              className="button secondary"
              onClick={() => setActive(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function AuditLog({ notify }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api("admin/logs")
      .then(setRows)
      .catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="panel-heading">
        <div>
          <h1>Nhật ký hoạt động</h1>
          <p className="muted">200 thao tác gần nhất trên hệ thống.</p>
        </div>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Người thực hiện</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>{x.name || "Tài khoản đã xóa"}</td>
                <td>{x.action}</td>
                <td>{x.entity}</td>
                <td>{new Date(x.created_at).toLocaleString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

