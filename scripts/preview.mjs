import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { prepareEnvironment, startDatabase, migrate } from "./runtime.mjs";
import { preparePreviewPort, rememberPreview } from "./preview-port.mjs";
function openBrowser(origin) {
  console.log("Mở trình duyệt tại: " + origin);
  if (process.platform === "win32" && !process.argv.includes("--no-browser"))
    spawn("rundll32", ["url.dll,FileProtocolHandler", origin], {
      stdio: "ignore",
      windowsHide: true,
    });
}
async function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (c) =>
      c === 0 ? resolve() : reject(Error("Lệnh thất bại: " + args.join(" "))),
    );
  });
}
try {
  await prepareEnvironment();
  const preview = await preparePreviewPort({
    reuseRunning: !process.argv.includes("--fresh"),
  });
  if (preview.existing) {
    console.log("Website của dự án này đã chạy. Mở lại website hiện có.");
    openBrowser(preview.origin);
  } else {
    const db = await startDatabase();
    try {
      await migrate();
    } finally {
      if (db) await db.stop();
    }
    if (!existsSync(".next/BUILD_ID"))
      await run(["node_modules/next/dist/bin/next", "build"]);
    const server = spawn(process.execPath, ["server.mjs"], {
      stdio: ["inherit", "pipe", "inherit"],
    });
    let announced = false;
    server.stdout.on("data", (data) => {
      process.stdout.write(data);
      if (String(data).includes("Website đang chạy tại")) announced = true;
    });
    let stopped = false;
    server.on("exit", (code) => {
      stopped = true;
      process.exitCode = code || 0;
    });
    server.on("error", (e) => {
      console.error(e.message);
      stopped = true;
      process.exitCode = 1;
    });
    const origin = process.env.NEXT_PUBLIC_SITE_URL;
    let ready = false;
    for (let i = 0; i < 90 && !stopped; i++) {
      try {
        const r = await fetch(origin + "/api/health");
        if (r.ok && announced) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (ready) {
      rememberPreview(origin);
      console.log("Website đã khởi động thành công.");
      console.log("Mở trình duyệt tại: " + origin);
      if (
        process.platform === "win32" &&
        !process.argv.includes("--no-browser")
      ) {
        spawn("rundll32", ["url.dll,FileProtocolHandler", origin], {
          stdio: "ignore",
        });
      } else console.log("Mở URL trên trong trình duyệt.");
    } else {
      console.error("Server chưa sẵn sàng. Kiểm tra lỗi phía trên.");
      server.kill();
      process.exitCode = 1;
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
