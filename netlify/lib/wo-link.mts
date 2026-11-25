import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

// ربط حساب مستخدم منصة الوبران بحسابه (نفس البريد) في منصة إسناد أوامر العمل.
// تُحفظ كلمة مرور المنصة مشفّرة (AES-256-GCM بمفتاح مشتق من AUTH_SECRET) ولا تُرسل للمتصفح أبداً،
// وتُستخدم فقط لفتح جلسة جديدة للمستخدم نفسه عند فتح المنصة أو الاستيراد من البوابة.
export const WO_SB = "https://qcrzkqtorraegjtdpija.supabase.co";
export const WO_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcnprcXRvcnJhZWdqdGRwaWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NDM0OTQsImV4cCI6MjExMDUxOTQ5NH0.StS5c1igG5tL_vgmpsyu-u3UZO3WXsoVNJSNZ9G0Eo8";
const store = () => getStore({ name: "wabran-auth", consistency: "strong" });
const key = () => crypto.createHash("sha256").update(String(Netlify.env.get("AUTH_SECRET")) + "|wo-link").digest();

function enc(obj: unknown) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const d = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), d]).toString("base64");
}
function dec(s: string) {
  const b = Buffer.from(s, "base64"), dc = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  dc.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([dc.update(b.subarray(28)), dc.final()]).toString("utf8"));
}

export async function woPasswordLogin(email: string, password: string) {
  const ctl = AbortSignal.timeout(8000);
  const r = await fetch(`${WO_SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: WO_ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password }), signal: ctl }).catch(() => null);
  if (!r || !r.ok) return null;
  const s = await r.json().catch(() => null);
  return s && s.access_token ? s : null;
}

// يُستدعى عند دخول البوابة أو من «حسابي»: يربط فقط إن نجح الدخول بنفس البريد وكلمة المرور في المنصة
export async function woLink(uid: string, email: string, password: string) {
  const s = await woPasswordLogin(email, password);
  if (!s) return false;
  await store().set("wolink:" + uid, enc({ email, password, at: new Date().toISOString() }));
  return true;
}
export async function woUnlink(uid: string) { await store().delete("wolink:" + uid); }
export async function woLinked(uid: string) { return !!(await store().get("wolink:" + uid)); }

// جلسة جديدة للمستخدم بحسابه في المنصة (أو null إن لم يكن مربوطاً أو تغيّرت كلمة مروره هناك)
export async function woUserSession(uid: string) {
  const raw = await store().get("wolink:" + uid);
  if (!raw) return null;
  let c: any; try { c = dec(String(raw)); } catch { return null; }
  const s = await woPasswordLogin(c.email, c.password);
  if (!s) { await woUnlink(uid); return null; }
  return s;
}
