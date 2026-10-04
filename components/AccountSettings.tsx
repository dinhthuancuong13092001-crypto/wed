import { useState } from "react";
import { Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { api } from "@/lib/client";
import type { User } from "@/lib/models";

function PasswordField({
  label,
  name,
  minimum = 1,
}: {
  label: string;
  name: string;
  minimum?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <div className="password-input">
        <input
          required
          type={show ? "text" : "password"}
          name={name}
          minLength={minimum}
          maxLength={200}
          autoComplete={
            name === "currentPassword" ? "current-password" : "new-password"
          }
        />
        <button
          type="button"
          aria-label={show ? "Ẩn " + label : "Hiện " + label}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
export default function AccountSettings({ user }: { user: User }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError("");
    setSuccess("");
    if (data.newPassword !== data.confirmPassword) {
      setError("Hai lần nhập mật khẩu mới không khớp.");
      return;
    }
    setBusy(true);
    try {
      await api("auth/password", "POST", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      form.reset();
      setSuccess(
        "Đã đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi.",
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel-heading">
        <div>
          <h1>Tài khoản của tôi</h1>
          <p className="muted">
            {user.name} · {user.email}
          </p>
        </div>
      </div>
      <form className="panel" style={{ maxWidth: 620 }} onSubmit={submit}>
        <h2>
          <KeyRound size={20} /> Đổi mật khẩu
        </h2>
        <p className="muted">Mật khẩu mới cần ít nhất 12 ký tự.</p>
        <PasswordField label="Mật khẩu hiện tại" name="currentPassword" />
        <PasswordField label="Mật khẩu mới" name="newPassword" minimum={12} />
        <PasswordField
          label="Nhập lại mật khẩu mới"
          name="confirmPassword"
          minimum={12}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {success && <p role="status">{success}</p>}
        <button className="button" disabled={busy}>
          <Save size={17} />
          {busy ? "Đang lưu…" : "Đổi mật khẩu"}
        </button>
      </form>
    </>
  );
}
