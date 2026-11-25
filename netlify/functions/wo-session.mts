import crypto from "node:crypto";
import type { Config } from "@netlify/functions";
import { currentUser, hasPlatform, json, cors } from "../lib/auth.mts";
import { woPasswordLogin, woUserSession } from "../lib/wo-link.mts";

// جلسة منصة إسناد أوامر العمل لمستخدم منصة الوبران:
// 1) إن كان حسابه مربوطاً (نفس البريد في المنصة) → جلسة بحسابه هو وصلاحياته هناك (مثل المدير: عرض واستيراد).
// 2) وإلا → حساب «مشاهد» للقراءة فقط (كلمة مروره مشتقة على الخادم من AUTH_SECRET).
const VIEWER = "hub-viewer@wabran-najran-hub.netlify.app";

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const u = await currentUser(req);
  if (!u) return json(req, { error: "سجّل الدخول لمنصة الوبران أولاً" }, 401);
  if (!hasPlatform(u, "assign")) return json(req, { error: "لا تملك صلاحية على منصة إسناد أوامر العمل" }, 403);
  let s: any = await woUserSession(u.id).catch(() => null), own = !!s;
  if (!s) {
    const sec = Netlify.env.get("AUTH_SECRET");
    if (!sec) return json(req, { error: "حساب العرض غير مضبوط" }, 503);
    s = await woPasswordLogin(VIEWER, crypto.createHmac("sha256", sec).update("wo-viewer-v1").digest("base64url"));
  }
  if (!s) return json(req, { error: "تعذّر فتح جلسة منصة أوامر العمل" }, 502);
  return json(req, { own, session: { access_token: s.access_token, refresh_token: s.refresh_token, token_type: s.token_type, expires_in: s.expires_in, expires_at: s.expires_at, user: s.user } });
};

export const config: Config = { path: "/api/wo-session", method: ["GET", "OPTIONS"] };
