"""Chạy website trường học từ Python (không cần thư viện Python bổ sung)."""

from pathlib import Path
import argparse
import os
import shutil
import subprocess
import sys


PROJECT_DIR = Path(__file__).resolve().parent


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=PROJECT_DIR, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Khởi động website trường học.")
    parser.add_argument("--build", action="store_true", help="Build lại trước khi mở website")
    parser.add_argument("--no-browser", action="store_true", help="Không tự mở trình duyệt")
    parser.add_argument("--check", action="store_true", help="Chỉ kiểm tra môi trường và dependencies")
    args = parser.parse_args()
    os.chdir(PROJECT_DIR)
    node = shutil.which("node")
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not node or not npm:
        raise RuntimeError("Chưa tìm thấy Node.js/npm. Cài Node.js 22 hoặc 24 LTS rồi chạy lại.")
    major = int(subprocess.check_output([node, "-p", "process.versions.node.split('.')[0]"], text=True).strip())
    if major < 22:
        raise RuntimeError("Cần Node.js 22 trở lên. Khuyến nghị Node.js 24 LTS.")
    if args.check:
        run([node, "--check", "scripts/preview.mjs"])
        run([node, "-e", "for (const name of ['next','pg','sharp','dotenv']) require.resolve(name)"])
        print("Python, Node.js và dependencies đã sẵn sàng.", flush=True)
        return 0
    if not (PROJECT_DIR / "node_modules" / "next").is_dir():
        print("Đang cài dependencies cho lần chạy đầu tiên…", flush=True)
        run([npm, "install"])
    if args.build:
        run([node, "scripts/migrate.mjs"])
        run([node, "node_modules/next/dist/bin/next", "build"])
    print("Đang chuẩn bị database và khởi động website. Giữ cửa sổ này mở.", flush=True)
    command = [node, "scripts/preview.mjs"]
    if args.build:
        command.append("--fresh")
    if args.no_browser:
        command.append("--no-browser")
    run(command)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nĐã dừng website.")
        sys.exit(0)
    except (RuntimeError, OSError, subprocess.CalledProcessError, ValueError) as error:
        print(f"\nKhông thể khởi động: {error}", file=sys.stderr)
        try:
            input("Nhấn Enter để đóng cửa sổ…")
        except (EOFError, KeyboardInterrupt):
            pass
        sys.exit(1)
