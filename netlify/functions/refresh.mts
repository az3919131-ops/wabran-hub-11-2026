import type { Config } from "@netlify/functions";
import { currentUser, hasPlatform, json } from "../lib/auth.mts";
import { syncBigProjects } from "../lib/sync.mts";

// تحديث فوري لبيانات منصة من مصدرها (حالياً: المشاريع الكبيرة) لمن له وصول إليها
export default async (req: Request) => {
  const u = await currentUser(req);
  if (!u) return json(req, { error: "سجّل الدخول أولاً" }, 401);
  const id = new URL(req.url).searchParams.get("id");
  if (id !== "bigprojects") return json(req, { error: "منصة غير مدعومة" }, 400);
  if (!hasPlatform(u, id)) return json(req, { error: "لا تملك صلاحية على هذه المنصة" }, 403);
  try { return json(req, { ok: true, ...(await syncBigProjects()) }); }
  catch (e) { return json(req, { error: String((e as Error).message || e).slice(0, 200) }, 502); }
};

export const config: Config = { path: "/api/refresh", method: ["GET", "POST"] };
