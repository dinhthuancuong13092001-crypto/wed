import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  Copy,
  Trash2,
  Pencil,
  X,
  Search,
  Check,
} from "lucide-react";
import { api } from "@/lib/client";
export default function MediaLibrary({
  select,
  onClose,
  notify,
}: {
  select?: (url: string, alt?: string) => void;
  onClose?: () => void;
  notify: (s: string) => void;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function load() {
    try {
      setRows(await api("admin/media"));
    } catch (e: any) {
      notify(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) throw Error("Ảnh tối đa 10 MB.");
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        await api("admin/media", "POST", { name: f.name, alt: "", data });
      }
      await load();
      notify("Đã tải ảnh lên.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className={select ? "modal-backdrop" : ""}>
      <section
        className={select ? "modal media-modal" : "media-section"}
        role={select ? "dialog" : undefined}
        aria-modal={select ? true : undefined}
      >
        <div className="panel-heading">
          <div>
            <h2>Thư viện media</h2>
            <p className="muted">JPG, PNG, WEBP, AVIF · Tối đa 10 MB mỗi ảnh</p>
          </div>
          {onClose && (
            <button className="icon-button" aria-label="Đóng" onClick={onClose}>
              <X />
            </button>
          )}
        </div>
        <div className="list-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              placeholder="Tìm ảnh…"
              aria-label="Tìm ảnh"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={17} />
            {busy ? "Đang tải…" : "Tải ảnh lên"}
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(e) => upload(e.target.files)}
          />
        </div>
        {!rows.length ? (
          <div className="admin-empty">
            <ImageIcon size={40} />
            <h3>Chưa có hình ảnh</h3>
            <p>Tải ảnh đầu tiên lên thư viện của bạn.</p>
          </div>
        ) : (
          <div className="media-grid">
            {rows
              .filter((x) =>
                x.name.toLowerCase().includes(search.toLowerCase()) && (!select || x.mime.startsWith("image/")),
              )
              .map((x) => (
                <div className="media-card" key={x.id}>
                  <button
                    type="button"
                    className="media-image"
                    onClick={() => (select ? select(x.url, x.alt) : setEdit(x))}
                    aria-label={"Chọn " + x.name}
                  >
                    {x.mime === "video/mp4" ? <span>▶ Clip MP4</span> : <img src={x.thumbnail} alt={x.alt || x.name} />}
                    {select && (
                      <span>
                        <Check size={20} />
                      </span>
                    )}
                  </button>
                  <strong>{x.name}</strong>
                  <small>{Math.round(x.size / 1024)} KB · {x.mime === "video/mp4" ? "MP4" : "WEBP"}</small>
                  <div>
                    <button
                      type="button"
                      aria-label="Sao chép URL"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          new URL(x.url, location.origin).href,
                        );
                        notify("Đã sao chép URL.");
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Sửa ảnh"
                      onClick={() => setEdit(x)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Xóa ảnh"
                      onClick={() => setDeleting(x)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
        {edit && (
          <div className="inline-edit">
            <h3>Thông tin ảnh</h3>
            {edit.mime === "video/mp4" ? <video controls src={edit.url} style={{ maxWidth: "100%", maxHeight: 240 }} /> : <img
              src={edit.url}
              alt={edit.alt}
              style={{ maxHeight: 200, maxWidth: "100%" }}
            />}
            <label>
              Tên ảnh
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            <label>
              Văn bản thay thế (Alt)
              <input
                value={edit.alt}
                onChange={(e) => setEdit({ ...edit, alt: e.target.value })}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={async () => {
                  try {
                    await api("admin/media/" + edit.id, "PUT", {
                      name: edit.name,
                      alt: edit.alt,
                    });
                    setEdit(null);
                    await load();
                    notify("Đã lưu thông tin ảnh.");
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                Lưu
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEdit(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        )}
        {deleting && (
          <div className="modal-backdrop">
            <div className="modal" role="alertdialog" aria-modal="true">
              <h3>Xóa ảnh này?</h3>
              <p>{deleting.name}</p>
              <div className="actions">
                <button
                  className="button secondary"
                  onClick={() => setDeleting(null)}
                >
                  Hủy
                </button>
                <button
                  className="button danger"
                  onClick={async () => {
                    try {
                      await api("admin/media/" + deleting.id, "DELETE");
                      setDeleting(null);
                      await load();
                      notify("Đã xóa ảnh.");
                    } catch (e: any) {
                      notify(e.message);
                    }
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
