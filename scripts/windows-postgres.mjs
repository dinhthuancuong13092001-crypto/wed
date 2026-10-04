import { mkdir, symlink, writeFile, unlink, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
async function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(output || "Không thể khởi động PostgreSQL.")),
    );
  });
}
export async function windowsPostgres() {
  const workspace = await realpath(process.cwd());
  const taskId = createHash("sha256")
    .update(workspace)
    .digest("hex")
    .slice(0, 12);
  const wrapper = path.join(tmpdir(), "school-cms-" + taskId);
  await mkdir(wrapper, { recursive: true });
  let drive;
  for (const letter of ["R", "S", "T", "U", "V", "W", "X", "Y", "Z"]) {
    if (!existsSync(letter + ":\\")) {
      drive = letter + ":";
      break;
    }
  }
  if (!drive)
    throw Error(
      "Không có ký tự ổ đĩa trống. Dùng PostgreSQL riêng với LOCAL_DATABASE=false.",
    );
  await run("subst.exe", [drive, workspace]);
  const alias = drive + "\\";
  const bin = path.join(
    alias,
    "node_modules",
    "@embedded-postgres",
    "windows-x64",
    "native",
    "bin",
  );
  const data = path.join(alias, "data", "postgres");
  const u = new URL(process.env.DATABASE_URL);
  const port = process.env.LOCAL_DB_PORT || "54329";
  if (!existsSync(path.join(data, "PG_VERSION"))) {
    const passwordFile = path.join(
      wrapper,
      "password-" + randomBytes(8).toString("hex"),
    );
    try {
      await writeFile(passwordFile, decodeURIComponent(u.password) + "\n", {
        mode: 0o600,
      });
      await run(path.join(bin, "initdb.exe"), [
        "-D",
        data,
        "--encoding=UTF8",
        "--locale=C",
        "--auth=scram-sha-256",
        "--username=" + decodeURIComponent(u.username),
        "--pwfile=" + passwordFile,
      ]);
    } finally {
      await unlink(passwordFile).catch(() => {});
    }
  }
  await run(path.join(bin, "pg_ctl.exe"), [
    "-D",
    data,
    "-l",
    path.join(alias, "data", "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${Number(port)}`,
    "-w",
    "start",
  ]);
  const control = {
    stop: async () => {
      try {
        await run(path.join(bin, "pg_ctl.exe"), [
          "-D",
          data,
          "-m",
          "fast",
          "-w",
          "stop",
        ]);
      } finally {
        await run("subst.exe", [drive, "/D"]);
      }
    },
  };
  try {
    const c = new pg.Client({
      connectionString: process.env.DATABASE_URL.replace(
        /\/[^/?]+(\?|$)/,
        "/postgres$1",
      ),
    });
    await c.connect();
    try {
      const name = u.pathname.slice(1);
      if (!/^[a-zA-Z0-9_]+$/.test(name))
        throw Error("Tên database không hợp lệ");
      if (
        !(await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
          .rowCount
      )
        await c.query(`CREATE DATABASE "${name}"`);
    } finally {
      await c.end();
    }
  } catch (e) {
    await control.stop();
    throw e;
  }
  return control;
}
