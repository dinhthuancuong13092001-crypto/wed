import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  X,
  Save,
  Send,
  ArrowLeft,
} from "lucide-react";
import { api } from "@/lib/client";
import { Resource, resources, RecordItem } from "@/lib/models";
import MediaLibrary from "./MediaLibrary";
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 280 }} />,
});
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function blank(group?: string) {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover: "",
    status: "DRAFT",
    category_id: null,
    published_at: new Date().toISOString(),
    data: group ? { group } : {},
  };
}
export default function ContentManager({
  type,
  notify,
  initialNew = false,
  group,
  authorName,
}: {
  type: Resource;
  notify: (s: string) => void;
  initialNew?: boolean;
  group?: "BOARD" | "TEACHER";
  authorName?: string;
}) {
  const [rows, setRows] = useState<RecordItem[]>([]),
    [categories, setCategories] = useState<RecordItem[]>([]),
    [edit, setEdit] = useState<any>(initialNew ? blank(group) : null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [page, setPage] = useState(1),
    [trash, setTrash] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [deleting, setDeleting] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [picker, setPicker] = useState<((s: string, alt?: string) => void) | null>(
      null,
    ),
    [preview, setPreview] = useState(false);
  const model = resources[type];
  const router = useRouter();
  async function load() {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        api("admin/" + type + (trash ? "?trash=true" : "")),
        api("admin/categories").catch(() => []),
      ]);
      setRows(
        group
          ? r.filter((x: RecordItem) => (x.data.group || "TEACHER") === group)
          : r,
      );
      setCategories(c);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setPage(1);
    setSelected([]);
    load();
  }, [type, trash, group]);
  async function save(status: string) {
    if (!edit.title.trim()) {
      notify("Vui lòng nhập tiêu đề.");
      return;
    }
    setBusy(true);
    try {
      const item = await api(
        "admin/" + type + (edit.id ? "/" + edit.id : ""),
        edit.id ? "PUT" : "POST",
        { ...edit, status },
      );
      notify(
        status === "PUBLISHED" ? "Đăng bài thành công." : "Đã lưu nội dung.",
      );
      setEdit(null);
      if (initialNew) await router.replace("/admin/" + type);
      else await load();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    try {
      for (const id of deleting)
        await api("admin/" + type + "/" + id, "DELETE");
      setDeleting([]);
      setSelected([]);
      await load();
      notify("Đã chuyển nội dung vào thùng rác.");
    } catch (e: any) {
      notify(e.message);
    }
  }
  function field(key: string, value: any) {
    setEdit((x: any) => (x ? { ...x, [key]: value } : null));
  }
  function data(key: string, value: any) {
    setEdit((x: any) => ({ ...x, data: { ...x.data, [key]: value } }));
  }
  const filtered = rows.filter(
    (x) =>
      x.title.toLowerCase().includes(search.toLowerCase()) &&
      (!filter || x.status === filter) &&
      (!categoryFilter || x.category_id === categoryFilter),
  );
  const visible = filtered.slice((page - 1) * 12, page * 12);
  if (edit)
    return (
      <div>
        <div className="panel-heading">
          <div>
            <button className="back-link" onClick={() => setEdit(null)}>
              <ArrowLeft size={16} /> {model.label}
            </button>
            <h1>
              {edit.id ? "Chỉnh sửa" : "Tạo"} {model.singular}
            </h1>
          </div>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => setPreview(true)}
            >
              <Eye size={16} />
              Xem trước
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => save("DRAFT")}
            >
              <Save size={16} />
              Lưu nháp
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => save("PUBLISHED")}
            >
              <Send size={16} />
              {busy ? "Đang lưu…" : "Xuất bản"}
            </button>
          </div>
        </div>
        <div className="editor-layout">
          <div className="panel editor-main">
            <label>
              {type === "teachers" ? "Họ và tên" : "Tiêu đề"} *
              <input
                className="title-input"
                value={edit.title}
                maxLength={250}
                onChange={(e) => {
                  const title = e.target.value;
                  setEdit({
                    ...edit,
                    title,
                    slug:
                      edit.slug === slugify(edit.title)
                        ? slugify(title)
                        : edit.slug || slugify(title),
                  });
                }}
                placeholder="Nhập tiêu đề…"
              />
            </label>
            <label>
              Slug
              <input
                value={edit.slug}
                onChange={(e) => field("slug", e.target.value)}
                placeholder="Tự tạo từ tiêu đề"
              />
            </label>
            <label>
              Mô tả ngắn
              <textarea
                value={edit.excerpt}
                rows={3}
                maxLength={1000}
                onChange={(e) => field("excerpt", e.target.value)}
              />
            </label>
            <label>Nội dung</label>
            <Editor
              key={edit.id || "new"}
              value={edit.content}
              onChange={(v) => field("content", v)}
              onImage={(cb) => setPicker(() => cb)}
            />
            {type === "events" && (
              <div className="form-grid">
                <label>
                  Bắt đầu *
                  <input
                    type="datetime-local"
                    value={
                      edit.data.start
                        ? new Date(edit.data.start)
                            .toLocaleString("sv-SE")
                            .replace(" ", "T")
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      data(
                        "start",
                        e.target.value
                          ? new Date(e.target.value).toISOString()
                          : "",
                      )
                    }
                  />
                </label>
                <label>
                  Kết thúc *
                  <input
                    type="datetime-local"
                    value={
                      edit.data.end
                        ? new Date(edit.data.end)
                            .toLocaleString("sv-SE")
                            .replace(" ", "T")
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      data(
                        "end",
                        e.target.value
                          ? new Date(e.target.value).toISOString()
                          : "",
                      )
                    }
                  />
                </label>
                <label>
                  Địa điểm
                  <input
                    value={edit.data.location || ""}
                    onChange={(e) => data("location", e.target.value)}
                  />
                </label>
              </div>
            )}
            {type === "announcements" && (
              <>
                <label>
                  Mức độ ưu tiên
                  <select
                    value={edit.data.priority || "NORMAL"}
                    onChange={(e) => data("priority", e.target.value)}
                  >
                    <option value="NORMAL">Bình thường</option>
                    <option value="HIGH">Quan trọng</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </label>
                <label>
                  URL tài liệu đính kèm
                  <input
                    value={edit.data.attachment || ""}
                    onChange={(e) => data("attachment", e.target.value)}
                    placeholder="https://…"
                  />
                </label>
              </>
            )}
            {type === "videos" && (
              <label>
                URL YouTube *
                <input
                  value={edit.data.youtube || ""}
                  onChange={(e) => data("youtube", e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
            )}
            {type === "teachers" && (
              <>
                <div className="form-grid">
                  <label>
                    Chức vụ
                    <input
                      value={edit.data.position || ""}
                      onChange={(e) => data("position", e.target.value)}
                    />
                  </label>
                  <label>
                    Tổ / bộ môn
                    <input
                      value={edit.data.department || ""}
                      onChange={(e) => data("department", e.target.value)}
                    />
                  </label>
                  <label>
                    Email công khai
                    <input
                      type="email"
                      value={edit.data.email || ""}
                      onChange={(e) => data("email", e.target.value)}
                    />
                  </label>
                  <label>
                    Nhóm
                    <select
                      value={edit.data.group || "TEACHER"}
                      onChange={(e) => data("group", e.target.value)}
                    >
                      <option value="TEACHER">Giáo viên</option>
                      <option value="BOARD">Ban Giám hiệu</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {type === "albums" && (
              <>
                <div className="panel-heading">
                  <h3>Danh sách ảnh ({(edit.data.images || []).length})</h3>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setPicker(
                        () => (u: string) =>
                          data("images", [...(edit.data.images || []), u]),
                      )
                    }
                  >
                    <Plus size={15} />
                    Thêm ảnh
                  </button>
                </div>
                <div className="gallery-edit">
                  {(edit.data.images || []).map((u: string, i: number) => (
                    <div key={i}>
                      <img src={u} alt={"Ảnh " + (i + 1)} />
                      <button
                        aria-label="Gỡ ảnh"
                        onClick={() =>
                          data(
                            "images",
                            edit.data.images.filter(
                              (_: string, j: number) => j !== i,
                            ),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside>
            <div className="panel">
              <h3>Thiết lập xuất bản</h3>
              <label>
                Tác giả
                <input readOnly value={edit.author_name || authorName || ""} />
              </label>
              <label>
                Trạng thái
                <select
                  value={edit.status}
                  onChange={(e) => field("status", e.target.value)}
                >
                  <option value="DRAFT">Bản nháp</option>
                  <option value="PUBLISHED">Đã xuất bản</option>
                  <option value="HIDDEN">Đã ẩn</option>
                </select>
              </label>
              <label>
                Ngày đăng
                <input
                  type="datetime-local"
                  value={new Date(edit.published_at)
                    .toLocaleString("sv-SE")
                    .replace(" ", "T")
                    .slice(0, 16)}
                  onChange={(e) =>
                    e.target.value &&
                    field(
                      "published_at",
                      new Date(e.target.value).toISOString(),
                    )
                  }
                />
              </label>
              <label>
                Chuyên mục
                <select
                  value={edit.category_id || ""}
                  onChange={(e) => field("category_id", e.target.value || null)}
                >
                  <option value="">Không có chuyên mục</option>
                  {categories.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!edit.data.featured}
                  onChange={(e) => data("featured", e.target.checked)}
                />
                Nội dung nổi bật
              </label>
              <label>
                Thứ tự hiển thị
                <input
                  type="number"
                  value={edit.data.order || 0}
                  onChange={(e) => data("order", Number(e.target.value))}
                />
              </label>
              <button
                className="button secondary full"
                disabled={busy}
                onClick={() => save(edit.status)}
              >
                <Save size={16} />
                Lưu thay đổi
              </button>
            </div>
            <div className="panel">
              <h3>Ảnh đại diện</h3>
              <button
                className="cover-picker"
                onClick={() =>
                  setPicker(() => (u: string) => field("cover", u))
                }
              >
                {edit.cover ? (
                  <img src={edit.cover} alt="Ảnh đại diện" />
                ) : (
                  <>
                    <ImageIcon size={32} />
                    <span>Chọn từ thư viện</span>
                  </>
                )}
              </button>
              {edit.cover && (
                <button
                  className="back-link"
                  onClick={() => field("cover", "")}
                >
                  Gỡ ảnh
                </button>
              )}
            </div>
            <div className="panel">
              <h3>Tối ưu tìm kiếm</h3>
              <label>
                SEO Title
                <input
                  maxLength={250}
                  value={edit.data.seoTitle || ""}
                  onChange={(e) => data("seoTitle", e.target.value)}
                />
              </label>
              <label>
                Meta Description
                <textarea
                  maxLength={300}
                  rows={3}
                  value={edit.data.seoDescription || ""}
                  onChange={(e) => data("seoDescription", e.target.value)}
                />
              </label>
              <label>
                Canonical URL
                <input
                  value={edit.data.canonical || ""}
                  onChange={(e) => data("canonical", e.target.value)}
                />
              </label>
              <button
                className="button secondary full"
                onClick={() =>
                  setPicker(() => (u: string) => data("ogImage", u))
                }
              >
                Chọn ảnh Open Graph
              </button>
              {edit.data.ogImage && (
                <img
                  className="og-thumb"
                  src={edit.data.ogImage}
                  alt="Open Graph"
                />
              )}
            </div>
          </aside>
        </div>
        {picker && (
          <MediaLibrary
            notify={notify}
            select={(u, alt) => {
              picker(u, alt);
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        )}{" "}
        {preview && (
          <div className="modal-backdrop">
            <div
              className="modal preview-modal"
              role="dialog"
              aria-modal="true"
            >
              <div className="panel-heading">
                <h3>Xem trước nội dung</h3>
                <button
                  aria-label="Đóng"
                  className="icon-button"
                  onClick={() => setPreview(false)}
                >
                  <X />
                </button>
              </div>
              <h1>{edit.title}</h1>
              <p>{edit.excerpt}</p>
              {edit.cover && (
                <img
                  className="article-cover"
                  src={edit.cover}
                  alt={edit.title}
                />
              )}
              <div
                className="prose"
                dangerouslySetInnerHTML={{ __html: edit.content }}
              />
            </div>
          </div>
        )}
      </div>
    );
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="eyebrow dark">QUẢN LÝ NỘI DUNG</span>
          <h1>{model.label}</h1>
          <p className="muted">
            {rows.length} {model.singular}
            {trash ? " trong thùng rác" : ""}
          </p>
        </div>
        <button className="button" onClick={() => setEdit(blank(group))}>
          <Plus size={18} />
          Tạo {model.singular}
        </button>
      </div>
      <div className="panel">
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Tìm kiếm"
              placeholder={"Tìm " + model.singular + "…"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="HIDDEN">Đã ẩn</option>
          </select>
          {type === "posts" && (
            <select
              aria-label="Lọc chuyên mục"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả chuyên mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <button className="button secondary" onClick={() => setTrash(!trash)}>
            <Trash2 size={16} />
            {trash ? "Tất cả nội dung" : "Thùng rác"}
          </button>
          {selected.length > 0 && !trash && (
            <button
              className="button danger"
              onClick={() => setDeleting(selected)}
            >
              Xóa {selected.length} mục
            </button>
          )}
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 260 }} />
        ) : !filtered.length ? (
          <div className="admin-empty">
            <div className="empty-symbol">
              <FileText size={37} />
            </div>
            <h2>
              Chưa có {model.singular}
              {type === "posts" ? " nào" : ""}
            </h2>
            <p>
              {type === "posts"
                ? "Bạn chưa đăng bài viết nào."
                : "Nội dung mới sẽ xuất hiện tại đây."}
            </p>
            {!trash && (
              <button className="button" onClick={() => setEdit(blank(group))}>
                <Plus size={17} />
                {type === "posts"
                  ? "TẠO BÀI VIẾT ĐẦU TIÊN"
                  : "TẠO " + model.singular.toUpperCase()}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        checked={
                          visible.length > 0 &&
                          visible.every((x) => selected.includes(x.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? visible.map((x) => x.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>Tiêu đề</th>
                    <th>Chuyên mục</th>
                    <th>Tác giả</th>
                    <th>Trạng thái</th>
                    <th>Ngày</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={"Chọn " + x.title}
                          checked={selected.includes(x.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, x.id]
                                : selected.filter((id) => id !== x.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className="table-title">
                          {x.cover && <img src={x.cover} alt="" />}
                          <strong>{x.title}</strong>
                        </div>
                      </td>
                      <td>{x.category_name || "—"}</td>
                      <td>{x.author_name}</td>
                      <td>
                        <span className={"badge " + x.status}>
                          {x.status === "PUBLISHED"
                            ? "Đã xuất bản"
                            : x.status === "DRAFT"
                              ? "Bản nháp"
                              : "Đã ẩn"}
                        </span>
                      </td>
                      <td>
                        {new Date(x.published_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td>
                        <div className="row-actions">
                          {trash ? (
                            <button
                              title="Khôi phục"
                              onClick={async () => {
                                await api(
                                  "admin/" + type + "/" + x.id,
                                  "PATCH",
                                  { action: "restore" },
                                );
                                await load();
                                notify("Đã khôi phục.");
                              }}
                            >
                              <RotateCcw size={17} />
                            </button>
                          ) : (
                            <>
                              <button title="Sửa" onClick={() => setEdit(x)}>
                                <Pencil size={17} />
                              </button>
                              {x.status === "PUBLISHED" && (
                                <Link
                                  title="Xem"
                                  target="_blank"
                                  href={"/" + model.route + "/" + x.slug}
                                >
                                  <Eye size={17} />
                                </Link>
                              )}
                              <button
                                title="Ẩn"
                                onClick={async () => {
                                  await api(
                                    "admin/" + type + "/" + x.id,
                                    "PATCH",
                                    { action: "hide" },
                                  );
                                  await load();
                                  notify("Đã ẩn nội dung.");
                                }}
                              >
                                <EyeOff size={17} />
                              </button>
                              <button
                                title="Xóa"
                                onClick={() => setDeleting([x.id])}
                              >
                                <Trash2 size={17} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                ← Trang trước
              </button>
              <span>
                Trang {page} / {Math.max(1, Math.ceil(filtered.length / 12))}
              </span>
              <button
                disabled={page * 12 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Trang sau →
              </button>
            </div>
          </>
        )}
      </div>
      {deleting.length > 0 && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true">
            <div className="danger-symbol">
              <Trash2 />
            </div>
            <h2>Bạn có chắc chắn muốn xóa {model.singular} này?</h2>
            <p>Nội dung được chuyển vào thùng rác và có thể khôi phục.</p>
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => setDeleting([])}
              >
                Hủy
              </button>
              <button className="button danger" onClick={remove}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
