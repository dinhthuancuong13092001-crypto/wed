import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { realpathSync, readFileSync, writeFileSync } from "node:fs";
export function rememberPreview(origin) {
  writeFileSync(".preview-runtime.json", JSON.stringify({ origin }));
}
export function projectId() {
  const root = realpathSync(process.cwd());
  return createHash("sha256")
    .update(process.platform === "win32" ? root.toLowerCase() : root)
    .digest("hex");
}
async function availablePort(port, host) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, host, () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
    });
  });
}
export async function preparePreviewPort({
  reuseRecorded = true,
  reuseRunning = true,
} = {}) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (reuseRecorded && reuseRunning)
    try {
      const saved = JSON.parse(readFileSync(".preview-runtime.json", "utf8"));
      const url = new URL(saved.origin);
      if (
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ) {
        const response = await fetch(url.origin + "/api/health", {
          signal: AbortSignal.timeout(1500),
        });
        if (
          response.ok &&
          response.headers.get("x-school-project") === projectId()
        )
          return { existing: true, origin: url.origin };
      }
    } catch {}
  if (reuseRunning)
    try {
      const response = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(1500),
      });
      if (
        response.ok &&
        response.headers.get("x-school-project") === projectId()
      )
        return { existing: true, origin };
    } catch {}
  const host = process.env.HOST || "127.0.0.1";
  try {
    await availablePort(Number(process.env.PORT || 3000), host);
    return { existing: false, origin };
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
  }
  const url = new URL(origin);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw Error(
      "Cổng đang được sử dụng. Dừng server cũ hoặc thay PORT và NEXT_PUBLIC_SITE_URL trong .env.",
    );
  const selected = await availablePort(0, host);
  console.log(
    `Cổng ${process.env.PORT || 3000} đang bận. Website sẽ chạy ở cổng ${selected}.`,
  );
  process.env.PORT = String(selected);
  url.port = String(selected);
  process.env.NEXT_PUBLIC_SITE_URL = url.origin;
  process.env.SITE_URL = url.origin;
  return { existing: false, origin: url.origin };
}
