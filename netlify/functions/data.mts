import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

// القاعدة المشتركة للبوابة: مفاتيح محددة فقط تُقرأ وتُكتب.
const KEYS = new Set(["snapshots", "licenses", "cards", "summary", "context", "log", "ds_projects", "ds_schedule", "ds_invoices", "ds_assign", "ds_dispatch", "sync", "dispatch"]);
const MAX_BYTES = 4_000_000;

// المنصات المستقلة المسموح لها بالقراءة والكتابة في القاعدة المشتركة من نطاقها
const ORIGINS = new Set(["https://najran-safety-cards.netlify.app", "https://najran-dispatch-board.netlify.app"]);
const KEY_BY_ORIGIN: Record<string, string[]> = { "https://najran-safety-cards.netlify.app": ["cards"], "https://najran-dispatch-board.netlify.app": ["dispatch"] };

export default async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const cors: Record<string, string> = ORIGINS.has(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, PUT, OPTIONS", "access-control-allow-headers": "content-type, x-hub-pin", vary: "origin" }
    : {};
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const res = await handle(req, origin);
  Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
  return res;
};

async function handle(req: Request, origin: string) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!KEYS.has(key)) return Response.json({ error: "مفتاح غير معروف" }, { status: 400 });
  if (KEY_BY_ORIGIN[origin] && !KEY_BY_ORIGIN[origin].includes(key)) return Response.json({ error: "غير مسموح لهذه المنصة" }, { status: 403 });
  const store = getStore({ name: "wabran-hub", consistency: "strong" });

  if (req.method === "GET") {
    const value = await store.get(key, { type: "json" });
    return Response.json({ key, value: value ?? null }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "PUT") {
    const pin = Netlify.env.get("HUB_ADMIN_PIN");
    // مزامنة لوحة التوزيع تلقائية من متصفحات مستخدميها فلا تحمل رمزاً
    if (pin && req.headers.get("x-hub-pin") !== pin && key !== "context" && key !== "dispatch") {
      return Response.json({ error: "رمز الإدارة غير صحيح. أدخل الرمز من إعدادات البوابة." }, { status: 401 });
    }
    const text = await req.text();
    if (text.length > MAX_BYTES) return Response.json({ error: "البيانات أكبر من الحد المسموح" }, { status: 413 });
    let value: unknown;
    try { value = JSON.parse(text); } catch { return Response.json({ error: "صيغة JSON غير صحيحة" }, { status: 400 }); }
    await store.setJSON(key, value);
    return Response.json({ ok: true, key, savedAt: new Date().toISOString() });
  }

  return new Response("Method not allowed", { status: 405 });
}

export const config: Config = { path: "/api/data", method: ["GET", "PUT", "OPTIONS"] };
