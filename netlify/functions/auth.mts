import type { Config } from "@netlify/functions";
import crypto from "node:crypto";
import { getUsers, saveUsers, getResets, saveResets, normEmail, hashPassword, checkPassword, signToken, currentUser, publicUser, json, cors, cleanPerms, sendMail, ROLES, PLATFORMS, LEVELS, CAPS } from "../lib/auth.mts";

// الدخول الموحد لمنصة الوبران: /api/auth/login | me | forgot | reset | password | bootstrap | meta
const HUB = "https://wabran-najran-hub.netlify.app/";
const fails = new Map<string, { n: number; t: number }>();

export default async (req: Request, context: any) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const action = new URL(req.url).pathname.split("/").pop();
  const body: any = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (action === "meta") return json(req, { roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { label: v.label, access: v.access, caps: v.caps }])), platforms: PLATFORMS, levels: LEVELS, caps: CAPS });

  if (action === "me") {
    const u = await currentUser(req);
    return u ? json(req, { user: publicUser(u) }) : json(req, { error: "غير مسجل الدخول" }, 401);
  }

  if (action === "login" && req.method === "POST") {
    const ip = context?.ip || "x", f = fails.get(ip);
    if (f && f.n >= 8 && Date.now() - f.t < 15 * 60e3) return json(req, { error: "محاولات كثيرة. حاول بعد 15 دقيقة." }, 429);
    const users = await getUsers(), u = users.find((x) => x.email === normEmail(body.email));
    if (!u || !u.active || !checkPassword(u, String(body.password || ""))) {
      fails.set(ip, { n: (f && Date.now() - f.t < 15 * 60e3 ? f.n : 0) + 1, t: Date.now() });
      return json(req, { error: "البريد أو كلمة المرور غير صحيحة" }, 401);
    }
    fails.delete(ip);
    u.lastLogin = new Date().toISOString(); await saveUsers(users);
    return json(req, { token: signToken(u.id), user: publicUser(u) });
  }

  // أول حساب فقط: يُنشأ مدير النظام عندما لا يوجد أي مستخدم
  if (action === "bootstrap" && req.method === "POST") {
    const users = await getUsers();
    if (users.length) return json(req, { error: "تم إنشاء مدير النظام مسبقاً" }, 409);
    const email = normEmail(body.email), pw = String(body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 6) return json(req, { error: "بريد أو كلمة مرور غير صالحة" }, 400);
    const now = new Date().toISOString(), { salt, hash } = hashPassword(pw);
    users.push({ id: crypto.randomUUID(), email, name: String(body.name || "مدير النظام"), ...cleanPerms("admin", null, null), active: true, salt, hash, createdAt: now, updatedAt: now });
    await saveUsers(users);
    return json(req, { ok: true });
  }

  if (action === "forgot" && req.method === "POST") {
    const email = normEmail(body.email), users = await getUsers(), u = users.find((x) => x.email === email && x.active);
    // الرد نفسه دائماً حتى لا يُكشف وجود الحساب
    const generic = { ok: true, message: "إن كان البريد مسجلاً فستصله رسالة فيها رابط تعيين كلمة مرور جديدة خلال دقائق." };
    if (!u) return json(req, generic);
    const tok = crypto.randomBytes(32).toString("hex"), id = crypto.createHash("sha256").update(tok).digest("hex");
    const resets = await getResets(); const now = Date.now();
    for (const k of Object.keys(resets)) if (resets[k].exp < now) delete resets[k];
    resets[id] = { uid: u.id, exp: now + 30 * 60e3 }; await saveResets(resets);
    const link = `${HUB}#/reset/${tok}`;
    const sent = await sendMail(u.email, "استرجاع كلمة المرور — منصة الوبران نجران",
      `<div dir="rtl" style="font-family:Tahoma,Arial">مرحباً ${u.name}،<br><br>طُلب تعيين كلمة مرور جديدة لحسابك في منصة الوبران.<br><a href="${link}">اضغط هنا لتعيين كلمة مرور جديدة</a> (صالح 30 دقيقة).<br><br>إن لم تطلب ذلك فتجاهل هذه الرسالة.<br><br>Project Manager | Eng. Ahmed Zahran</div>`);
    if (!sent.ok) console.log("password reset mail not sent:", sent.reason);
    return json(req, sent.ok ? generic : { ok: false, error: "تعذّر إرسال البريد الآن: لم يُضبط مزود البريد للمنصة بعد. تواصل مع مدير النظام." }, sent.ok ? 200 : 503);
  }

  if (action === "reset" && req.method === "POST") {
    const id = crypto.createHash("sha256").update(String(body.token || "")).digest("hex");
    const resets = await getResets(), r = resets[id];
    if (!r || r.exp < Date.now()) return json(req, { error: "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً." }, 400);
    const pw = String(body.password || "");
    if (pw.length < 6) return json(req, { error: "كلمة المرور 6 أحرف على الأقل" }, 400);
    const users = await getUsers(), u = users.find((x) => x.id === r.uid);
    if (!u) return json(req, { error: "الحساب غير موجود" }, 404);
    Object.assign(u, hashPassword(pw), { updatedAt: new Date().toISOString() });
    delete resets[id]; await saveUsers(users); await saveResets(resets);
    return json(req, { ok: true, token: signToken(u.id), user: publicUser(u) });
  }

  if (action === "password" && req.method === "POST") {
    const me = await currentUser(req);
    if (!me) return json(req, { error: "سجّل الدخول أولاً" }, 401);
    const users = await getUsers(), u = users.find((x) => x.id === me.id)!;
    if (!checkPassword(u, String(body.current || ""))) return json(req, { error: "كلمة المرور الحالية غير صحيحة" }, 400);
    if (String(body.password || "").length < 6) return json(req, { error: "كلمة المرور الجديدة 6 أحرف على الأقل" }, 400);
    Object.assign(u, hashPassword(String(body.password)), { updatedAt: new Date().toISOString() });
    await saveUsers(users);
    return json(req, { ok: true });
  }

  return json(req, { error: "غير موجود" }, 404);
};

export const config: Config = { path: "/api/auth/*", method: ["GET", "POST", "OPTIONS"] };
