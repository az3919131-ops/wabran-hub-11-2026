import type { Config } from "@netlify/functions";
import crypto from "node:crypto";
import { getUsers, saveUsers, normEmail, hashPassword, currentUser, publicUser, json, cors, can, cleanPerms } from "../lib/auth.mts";

// إدارة المستخدمين والصلاحيات — لمدير النظام فقط
export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const me = await currentUser(req);
  if (!me) return json(req, { error: "سجّل الدخول أولاً" }, 401);
  if (!can(me, "users")) return json(req, { error: "إدارة المستخدمين لمدير النظام فقط" }, 403);
  const users = await getUsers(), id = new URL(req.url).searchParams.get("id");
  const body: any = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};
  const now = new Date().toISOString();

  if (req.method === "GET") return json(req, { users: users.map(publicUser) });

  if (req.method === "POST") {
    const email = normEmail(body.email), pw = String(body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(req, { error: "بريد غير صالح" }, 400);
    if (users.some((u) => u.email === email)) return json(req, { error: "يوجد مستخدم بهذا البريد" }, 409);
    if (pw.length < 6) return json(req, { error: "كلمة المرور 6 أحرف على الأقل" }, 400);
    const u = { id: crypto.randomUUID(), email, name: String(body.name || email).slice(0, 80), ...cleanPerms(body.role, body.access, body.caps), active: body.active !== false, ...hashPassword(pw), createdAt: now, updatedAt: now };
    users.push(u); await saveUsers(users);
    return json(req, { user: publicUser(u) }, 201);
  }

  const u = users.find((x) => x.id === id);
  if (!u) return json(req, { error: "المستخدم غير موجود" }, 404);

  if (req.method === "PUT") {
    const self = u.id === me.id;
    const admins = users.filter((x) => x.role === "admin" && x.active);
    if (self && (body.role && body.role !== "admin" || body.active === false)) return json(req, { error: "لا يمكنك إزالة صلاحية المدير أو إيقاف حسابك" }, 400);
    if (u.role === "admin" && admins.length === 1 && (body.role && body.role !== "admin" || body.active === false)) return json(req, { error: "يجب أن يبقى مدير نظام واحد على الأقل" }, 400);
    if (body.name != null) u.name = String(body.name).slice(0, 80);
    if (body.email != null) { const e = normEmail(body.email); if (!/^\S+@\S+\.\S+$/.test(e)) return json(req, { error: "بريد غير صالح" }, 400); if (users.some((x) => x.email === e && x.id !== u.id)) return json(req, { error: "يوجد مستخدم بهذا البريد" }, 409); u.email = e; }
    if (body.role != null || body.access != null || body.caps != null) Object.assign(u, cleanPerms(body.role ?? u.role, body.access ?? u.access, body.caps ?? u.caps));
    if (body.active != null) u.active = !!body.active;
    if (body.password) { if (String(body.password).length < 6) return json(req, { error: "كلمة المرور 6 أحرف على الأقل" }, 400); Object.assign(u, hashPassword(String(body.password))); }
    u.updatedAt = now; await saveUsers(users);
    return json(req, { user: publicUser(u) });
  }

  if (req.method === "DELETE") {
    if (u.id === me.id) return json(req, { error: "لا يمكنك حذف حسابك" }, 400);
    await saveUsers(users.filter((x) => x.id !== u.id));
    return json(req, { ok: true });
  }
  return json(req, { error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/users", method: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] };
