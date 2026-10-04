import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { projectId } from "./scripts/preview-port.mjs";
import {
  prepareEnvironment,
  startDatabase,
  migrate,
} from "./scripts/runtime.mjs";
process.env.NODE_ENV = process.argv.includes("--dev")
  ? "development"
  : "production";
const { default: next } = await import("next");
let db, server, app;
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  if (server) await new Promise((r) => server.close(r));
  if (app) await app.close();
  if (db) await db.stop();
  process.exit();
}
try {
  await prepareEnvironment();
  const dev = process.argv.includes("--dev");
  if (!dev && !existsSync(".next/BUILD_ID"))
    throw Error("Chưa có production build. Chạy npm run build trước.");
  db = await startDatabase();
  await migrate();
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("PORT không hợp lệ.");
  app = next({ dev, hostname: host, port });
  await app.prepare();
  const handle = app.getRequestHandler();
  server = createServer((req, res) => {
    if (req.url?.split("?")[0] === "/api/health")
      res.setHeader("X-School-Project", projectId());
    return handle(req, res);
  });
  server.requestTimeout = 30000;
  server.on("error", async (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? `Cổng ${port} đang được sử dụng.`
        : "Không thể khởi động server.",
    );
    if (db) await db.stop();
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`Website đang chạy tại ${process.env.NEXT_PUBLIC_SITE_URL}`);
    console.log(
      "Quản trị: /admin. Thiết lập lần đầu: /admin/setup (mã SETUP_TOKEN trong .env).",
    );
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (e) {
  console.error(e.message);
  if (db) await db.stop().catch(() => {});
  process.exit(1);
}
