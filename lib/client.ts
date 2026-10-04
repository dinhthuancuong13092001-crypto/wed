export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.error || "Có lỗi xảy ra.");
  return b;
}
