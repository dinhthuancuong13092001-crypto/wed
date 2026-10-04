import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "./db";
import type { User } from "./models";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  try {
    const [salt, h] = hash.split(":");
    const key = Buffer.from(h, "hex");
    const actual = scryptSync(password, salt, 64);
    return key.length === actual.length && timingSafeEqual(key, actual);
  } catch {
    return false;
  }
}
export function tokenHash(token: string) {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update(token)
    .digest("hex");
}
export async function currentUser(req: Pick<NextApiRequest, "cookies">) {
  const token = req.cookies.school_session;
  if (!token) return null;
  return (
    (
      await query<User>(
        "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
        [tokenHash(token)],
      )
    )[0] ?? null
  );
}
export function sameOrigin(req: NextApiRequest) {
  const origin = req.headers.origin;
  const trusted = new URL(
    process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000",
  ).origin;
  if (!origin || origin !== trusted)
    throw new HttpError(403, "Yêu cầu không hợp lệ. Vui lòng tải lại trang.");
}
export async function rateLimit(key: string, max = 10, seconds = 600) {
  const [r] = await query(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2 * interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING count",
    [key, seconds],
  );
  if (r.count > max)
    throw new HttpError(
      429,
      "Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.",
    );
}
export function clientIp(req: NextApiRequest) {
  return req.socket.remoteAddress || "unknown";
}
export async function requireUser(req: NextApiRequest) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, "Vui lòng đăng nhập.");
  return u;
}
export function requireRole(u: User, roles: string[]) {
  if (!roles.includes(u.role))
    throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
}
export async function createSession(userId: string, res: NextApiResponse) {
  const token = randomBytes(32).toString("hex");
  await query("DELETE FROM sessions WHERE expires_at<now()");
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [tokenHash(token), userId],
  );
  res.setHeader(
    "Set-Cookie",
    `school_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
  );
}
export async function audit(
  u: User,
  action: string,
  entity: string,
  id?: string,
) {
  await query(
    "INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)",
    [u.id, action, entity, id || null],
  );
}
