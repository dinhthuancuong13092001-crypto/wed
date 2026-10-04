import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Video,
  Undo,
  Redo,
  Upload,
} from "lucide-react";
const Clip = Node.create({
  name: "clip", group: "block", atom: true,
  addAttributes() { return { src: { default: null } }; },
  parseHTML() { return [{ tag: "video[src]" }]; },
  renderHTML({ HTMLAttributes }) { return ["video", mergeAttributes(HTMLAttributes, { controls: "", preload: "metadata", playsinline: "" })]; },
});
export default function Editor({
  value,
  onChange,
  onImage,
}: {
  value: string;
  onChange: (v: string) => void;
  onImage: (cb: (url: string, alt?: string) => void) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Clip,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ nocookie: true }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose editor-content",
        "aria-label": "Nội dung bài viết",
      },
    },
  });
  async function upload(files: FileList | null) {
    if (!files || !editor) return;
    setUploading(true);
    setUploadMessage("");
    let inserted = 0;
    try {
      for (const file of Array.from(files)) {
        const clip = /\.mp4$/i.test(file.name);
        if (file.size > (clip ? 50 : 10) * 1024 * 1024) throw Error(clip ? "Clip tối đa 50 MB." : "Ảnh tối đa 10 MB.");
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(Error("Không đọc được tệp."));
          reader.readAsDataURL(file);
        });
        const media = await api("admin/media", "POST", { name: file.name, alt: "", data });
        editor.chain().focus().insertContent(clip
          ? [{ type: "clip", attrs: { src: media.url } }, { type: "paragraph" }]
          : [{ type: "image", attrs: { src: media.url, alt: file.name } }, { type: "paragraph" }]).run();
        inserted++;
      }
      setUploadMessage(`Đã chèn ${inserted} tệp. Hãy lưu bài viết để giữ thay đổi.`);
    } catch (error: any) { setUploadMessage(`${inserted ? `Đã chèn ${inserted} tệp. ` : ""}${error.message}`); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  if (!editor)
    return <div className="editor-loading">Đang tải trình soạn thảo…</div>;
  const tools = [
    ["Đậm", Bold, () => editor.chain().focus().toggleBold().run(), "bold"],
    [
      "Nghiêng",
      Italic,
      () => editor.chain().focus().toggleItalic().run(),
      "italic",
    ],
    [
      "Gạch chân",
      Underline,
      () => editor.chain().focus().toggleUnderline().run(),
      "underline",
    ],
    [
      "Danh sách",
      List,
      () => editor.chain().focus().toggleBulletList().run(),
      "bulletList",
    ],
    [
      "Danh sách số",
      ListOrdered,
      () => editor.chain().focus().toggleOrderedList().run(),
      "orderedList",
    ],
    [
      "Trích dẫn",
      Quote,
      () => editor.chain().focus().toggleBlockquote().run(),
      "blockquote",
    ],
    [
      "Căn trái",
      AlignLeft,
      () => editor.chain().focus().setTextAlign("left").run(),
      "",
    ],
    [
      "Căn giữa",
      AlignCenter,
      () => editor.chain().focus().setTextAlign("center").run(),
      "",
    ],
    [
      "Căn phải",
      AlignRight,
      () => editor.chain().focus().setTextAlign("right").run(),
      "",
    ],
    [
      "Liên kết",
      LinkIcon,
      () => {
        const u = prompt("Nhập URL liên kết (https://…)");
        if (u && /^https?:\/\//.test(u))
          editor.chain().focus().setLink({ href: u }).run();
      },
      "link",
    ],
    [
      "Chèn ảnh",
      ImageIcon,
      () =>
        onImage((u, alt) =>
          editor
            .chain()
            .focus()
            .setImage({ src: u, alt: alt || "" })
            .run(),
        ),
      "",
    ],
    [
      "Chèn bảng",
      TableIcon,
      () =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
      "",
    ],
    [
      "YouTube",
      Video,
      () => {
        const u = prompt("URL YouTube");
        if (u) editor.commands.setYoutubeVideo({ src: u });
      },
      "",
    ],
    ["Hoàn tác", Undo, () => editor.chain().focus().undo().run(), ""],
    ["Làm lại", Redo, () => editor.chain().focus().redo().run(), ""],
  ] as const;
  return (
    <div className="rich-editor">
      <div className="article-media-upload">
        <button type="button" className="button secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload size={17} />{uploading ? "Đang tải và chèn…" : "Thêm nhiều ảnh / clip"}
        </button>
        <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4" onChange={(e) => upload(e.target.files)} />
        <small className="muted">Chọn nhiều tệp cùng lúc · Ảnh tối đa 10 MB · Clip MP4 tối đa 50 MB. Có thể chèn nhiều video YouTube bằng nút bên dưới.</small>
        {uploadMessage && <p role="status">{uploadMessage}</p>}
      </div>
      <div className="editor-toolbar">
        <select
          aria-label="Kiểu đoạn văn"
          value={
            editor.isActive("heading", { level: 1 })
              ? "1"
              : editor.isActive("heading", { level: 2 })
                ? "2"
                : editor.isActive("heading", { level: 3 })
                  ? "3"
                  : "0"
          }
          onChange={(e) => {
            const n = Number(e.target.value);
            n
              ? editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: n as 1 | 2 | 3 })
                  .run()
              : editor.chain().focus().setParagraph().run();
          }}
        >
          <option value="0">Đoạn văn</option>
          <option value="1">Tiêu đề H1</option>
          <option value="2">Tiêu đề H2</option>
          <option value="3">Tiêu đề H3</option>
        </select>
        {tools.map(([label, Icon, fn, active]) => (
          <button
            type="button"
            key={label}
            title={label}
            aria-label={label}
            className={active && editor.isActive(active) ? "active" : ""}
            onClick={fn}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
