import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { currentUser, hasPlatform, canEdit, can, json, cors, KEY_PLATFORM } from "../lib/auth.mts";

// القاعدة المشتركة للبوابة. القراءة لمن له وصول للمنصة، والكتابة لمن له «تعديل» عليها.
const KEYS = new Set(Object.keys(KEY_PLATFORM));
const MAX_BYTES = 4_000_000;

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const key = new URL(req.url).searchParams.get("key") || "";
  if (!KEYS.has(key)) return json(req, { error: "مفتاح غير معروف" }, 400);
  const store = getStore({ name: "wabran-hub", consistency: "strong" });
  const plat = KEY_PLATFORM[key];

  // كل قراءة وكتابة بحساب منصة الوبران (ومنها مزامنة لوحة التوزيع من متصفح المخطط بعد دخوله)
  const user = await currentUser(req);
  if (!user) return json(req, { error: "سجّل الدخول لمنصة الوبران أولاً" }, 401);
  if (!hasPlatform(user, plat)) return json(req, { error: "لا تملك صلاحية على هذه المنصة" }, 403);

  if (req.method === "GET") {
    const value = await store.get(key, { type: "json" });
    return json(req, { key, value: value ?? null });
  }
  if (req.method === "PUT") {
    if (key === "summary" && !can(user, "assistant")) return json(req, { error: "لا تملك صلاحية المساعد الذكي" }, 403);
    if (key !== "context" && key !== "summary" && !canEdit(user, plat)) return json(req, { error: "صلاحيتك على هذه المنصة عرض فقط" }, 403);
    const text = await req.text();
    if (text.length > MAX_BYTES) return json(req, { error: "البيانات أكبر من الحد المسموح" }, 413);
    let value: unknown;
    try { value = JSON.parse(text); } catch { return json(req, { error: "صيغة JSON غير صحيحة" }, 400); }
    await store.setJSON(key, value);
    return json(req, { ok: true, key, savedAt: new Date().toISOString() });
  }
  return json(req, { error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/data", method: ["GET", "PUT", "OPTIONS"] };
