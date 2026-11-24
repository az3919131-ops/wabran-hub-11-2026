import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

/*
  نظام المستخدمين والصلاحيات لمنصة الوبران.
  - كلمات المرور تُحفظ مشفّرة (scrypt + salt) في Netlify Blobs، ولا تُحفظ نصاً أبداً.
  - الجلسة رمز موقّع (HMAC-SHA256) بمفتاح سري في متغير البيئة AUTH_SECRET، صالح 7 أيام.
  - الدور يحدد الصلاحيات الافتراضية، ويمكن لمدير النظام تعديل منصات وصلاحيات كل مستخدم على حدة.
*/

export const PLATFORMS = ["bigprojects", "projects", "schedule", "invoices", "assign", "dispatch", "licenses", "safety"];
// مستويات الوصول لكل منصة (كلوحة صلاحيات التزام): بلا وصول < عرض < عرض وتصدير < تعديل
export const LEVELS = ["none", "view", "export", "edit"];
export const CAPS = ["assistant", "sync", "users"];
const all = (lv: string) => Object.fromEntries(PLATFORMS.map((p) => [p, lv]));
const pick = (m: Record<string, string>) => ({ ...all("none"), ...m });

export const ROLES: Record<string, { label: string; access: Record<string, string>; caps: string[] }> = {
  admin: { label: "مدير النظام", access: all("edit"), caps: CAPS },
  pm: { label: "مدير مشروع", access: all("edit"), caps: ["assistant", "sync"] },
  site_eng: { label: "مهندس موقع — التخطيط والرخص والسلامة", access: pick({ dispatch: "edit", schedule: "edit", licenses: "edit", safety: "edit", projects: "view", bigprojects: "view" }), caps: ["assistant"] },
  accountant: { label: "محاسب — عرض وتصدير للمطابقة المالية", access: pick({ invoices: "export", bigprojects: "export", projects: "export", assign: "export" }), caps: ["assistant"] },
  viewer: { label: "مشاهد — عرض فقط", access: all("view"), caps: [] },
  custom: { label: "مخصّص — اختر لكل منصة", access: all("none"), caps: [] },
};

// المفاتيح في القاعدة المشتركة وما يقابلها من منصات (للتحقق من صلاحية القراءة والكتابة)
export const KEY_PLATFORM: Record<string, string | null> = {
  cards: "safety", licenses: "licenses", dispatch: "dispatch",
  ds_bigprojects: "bigprojects", ds_projects: "projects", ds_schedule: "schedule", ds_invoices: "invoices", ds_assign: "assign", ds_dispatch: "dispatch",
  snapshots: null, summary: null, context: null, log: null, sync: null,
};

// المنصات المستقلة المسموح لها باستخدام الدخول الموحد
export const ORIGINS = new Set([
  "https://najran-safety-cards.netlify.app",
  "https://najran-dispatch-board.netlify.app",
  "https://wabran-licenses-platform.netlify.app",
  "https://najran-wabran-dor-dashboard.netlify.app",
]);

export function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return ORIGINS.has(o)
    ? { "access-control-allow-origin": o, "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS", "access-control-allow-headers": "content-type, authorization, x-hub-pin", vary: "origin" }
    : {};
}
export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(req) } });
}

const store = () => getStore({ name: "wabran-auth", consistency: "strong" });
export type User = {
  id: string; email: string; name: string; role: string; access: Record<string, string>; caps: string[]; active: boolean;
  salt: string; hash: string; createdAt: string; updatedAt: string; lastLogin?: string;
};
export async function getUsers(): Promise<User[]> {
  const v = (await store().get("users", { type: "json" })) as { users: User[] } | null;
  return v?.users || [];
}
export async function saveUsers(users: User[]) { await store().setJSON("users", { users }); }
export async function getResets(): Promise<Record<string, { uid: string; exp: number }>> {
  return ((await store().get("resets", { type: "json" })) as any) || {};
}
export async function saveResets(r: Record<string, { uid: string; exp: number }>) { await store().setJSON("resets", r); }

export const normEmail = (e: unknown) => String(e || "").trim().toLowerCase();
export function hashPassword(pw: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return { salt, hash };
}
export function checkPassword(u: User, pw: string) {
  const h = crypto.scryptSync(String(pw), u.salt, 64);
  const ref = Buffer.from(u.hash, "hex");
  return ref.length === h.length && crypto.timingSafeEqual(ref, h);
}

function secret() {
  const s = Netlify.env.get("AUTH_SECRET");
  if (!s || s.length < 32) throw new Error("AUTH_SECRET غير مضبوط");
  return s;
}
const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export function signToken(uid: string, days = 7) {
  const payload = b64u(JSON.stringify({ uid, exp: Date.now() + days * 864e5 }));
  const sig = b64u(crypto.createHmac("sha256", secret()).update(payload).digest());
  return payload + "." + sig;
}
export function verifyToken(tok: string | null): string | null {
  if (!tok) return null;
  const [payload, sig] = tok.split(".");
  if (!payload || !sig) return null;
  const good = b64u(crypto.createHmac("sha256", secret()).update(payload).digest());
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  try { const p = JSON.parse(Buffer.from(payload, "base64url").toString()); return p.exp > Date.now() ? p.uid : null; } catch { return null; }
}
export async function currentUser(req: Request): Promise<User | null> {
  const h = req.headers.get("authorization") || "";
  const uid = verifyToken(h.startsWith("Bearer ") ? h.slice(7) : null);
  if (!uid) return null;
  const u = (await getUsers()).find((x) => x.id === uid);
  return u && u.active ? u : null;
}
export const level = (u: User | null, p: string | null) => (!u ? "none" : u.role === "admin" || p == null ? "edit" : (u.access || {})[p] || "none");
export const can = (u: User | null, cap: string) => !!u && (u.role === "admin" || (u.caps || []).includes(cap));
export const hasPlatform = (u: User | null, p: string | null) => level(u, p) !== "none";
export const canEdit = (u: User | null, p: string | null) => level(u, p) === "edit";
export const publicUser = (u: User) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, roleLabel: ROLES[u.role]?.label || u.role,
  access: u.role === "admin" ? ROLES.admin.access : { ...all("none"), ...(u.access || {}) },
  caps: u.role === "admin" ? CAPS : u.caps || [], active: u.active, createdAt: u.createdAt, lastLogin: u.lastLogin || null,
});

export function cleanPerms(role: string, access: unknown, caps: unknown) {
  const r = ROLES[role] ? role : "custom";
  const acc: Record<string, string> = { ...ROLES[r].access };
  if (access && typeof access === "object" && r !== "admin") for (const p of PLATFORMS) { const v = String((access as any)[p] ?? ""); if (LEVELS.includes(v)) acc[p] = v; }
  const cp = Array.isArray(caps) && r !== "admin" ? caps.map(String).filter((x) => CAPS.includes(x) && x !== "users") : ROLES[r].caps;
  return { role: r, access: acc, caps: cp };
}

// إرسال بريد استرجاع كلمة المرور عبر Resend إن ضُبط مفتاحه (RESEND_API_KEY)
export async function sendMail(to: string, subject: string, html: string): Promise<{ ok: boolean; reason?: string }> {
  const key = Netlify.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "no_provider" };
  const from = Netlify.env.get("MAIL_FROM") || "Wabran Hub <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  return r.ok ? { ok: true } : { ok: false, reason: "send_failed_" + r.status };
}
