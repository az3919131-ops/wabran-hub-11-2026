import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

// القاعدة المشتركة للبوابة: مفاتيح محددة فقط تُقرأ وتُكتب.
const KEYS = new Set(["snapshots", "licenses", "cards", "summary", "context", "log", "ds_projects", "ds_schedule", "ds_invoices", "ds_assign", "ds_dispatch"]);
const MAX_BYTES = 4_000_000;

export default async (req: Request) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!KEYS.has(key)) return Response.json({ error: "مفتاح غير معروف" }, { status: 400 });
  const store = getStore({ name: "wabran-hub", consistency: "strong" });

  if (req.method === "GET") {
    const value = await store.get(key, { type: "json" });
    return Response.json({ key, value: value ?? null }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "PUT") {
    const pin = Netlify.env.get("HUB_ADMIN_PIN");
    if (pin && req.headers.get("x-hub-pin") !== pin && key !== "context") {
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
};

export const config: Config = { path: "/api/data", method: ["GET", "PUT"] };
