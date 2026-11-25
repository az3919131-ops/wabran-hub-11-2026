import crypto from "node:crypto";
import type { Config } from "@netlify/functions";
import { currentUser, hasPlatform, json, cors } from "../lib/auth.mts";

// دخول تلقائي لمنصة إسناد أوامر العمل: لمستخدم منصة الوبران الذي له وصول «إسناد أوامر العمل» فقط،
// تُفتح جلسة بحساب «مشاهد» للقراءة فقط في قاعدة المنصة. كلمة مروره مشتقة على الخادم من AUTH_SECRET ولا تُخزَّن ولا تصل للمتصفح.
const SB = "https://qcrzkqtorraegjtdpija.supabase.co";
const VIEWER = "hub-viewer@wabran-najran-hub.netlify.app";
// المفتاح العام للمنصة (منشور أصلاً في واجهتها، ليس سراً)
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcnprcXRvcnJhZWdqdGRwaWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NDM0OTQsImV4cCI6MjExMDUxOTQ5NH0.StS5c1igG5tL_vgmpsyu-u3UZO3WXsoVNJSNZ9G0Eo8";

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const u = await currentUser(req);
  if (!u) return json(req, { error: "سجّل الدخول لمنصة الوبران أولاً" }, 401);
  if (!hasPlatform(u, "assign")) return json(req, { error: "لا تملك صلاحية على منصة إسناد أوامر العمل" }, 403);
  const sec = Netlify.env.get("AUTH_SECRET");
  if (!sec) return json(req, { error: "حساب العرض غير مضبوط" }, 503);
  const email = VIEWER, key = ANON, password = crypto.createHmac("sha256", sec).update("wo-viewer-v1").digest("base64url");
  // جلسة مستقلة لكل طلب (لكل متصفح رمز تحديث خاص به)
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const s = await r.json().catch(() => ({}));
  if (!r.ok || !s.access_token) return json(req, { error: "تعذّر فتح جلسة منصة أوامر العمل" }, 502);
  return json(req, { session: { access_token: s.access_token, refresh_token: s.refresh_token, token_type: s.token_type, expires_in: s.expires_in, expires_at: s.expires_at, user: s.user } });
};

export const config: Config = { path: "/api/wo-session", method: ["GET", "OPTIONS"] };
