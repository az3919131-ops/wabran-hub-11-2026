import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

// حالة المزامنة فقط (تواريخ وأعداد، بلا أي بيانات): للتحقق من وصول آخر تحديث من كل منصة
export default async () => {
  const store = getStore({ name: "wabran-hub", consistency: "strong" });
  const out: Record<string, unknown> = {};
  for (const id of ["bigprojects", "projects", "schedule", "invoices", "assign"]) {
    const v: any = await store.get("ds_" + id, { type: "json" });
    out[id] = v ? { asof: v.asof || null, syncedAt: v.syncedAt || null, rows: v.rows?.length || 0, items: v.items || null, fromBrowser: !!v.monthly, lastMonth: v.monthly?.months?.at(-1)?.ym || null } : null;
  }
  const d: any = await store.get("dispatch", { type: "json" });
  out.dispatch = d ? { syncedAt: d.syncedAt || null, days: d.edc?.length || 0 } : null;
  const s: any = await store.get("sync", { type: "json" });
  out.autoSync = s ? { at: s.at, report: s.report } : null;
  return Response.json(out, { headers: { "cache-control": "no-store" } });
};

export const config: Config = { path: "/api/status" };
