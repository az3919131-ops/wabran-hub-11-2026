import { getStore } from "@netlify/blobs";

// مزامنة لوحات البوابة من المنصات الأصلية. كل مصدر يتحول إلى سجلات بصيغة واحدة: { asof, source, rows }.
const today = () => new Date().toISOString().slice(0, 10);
const STAGE: Record<string, string> = {
  delivery: "تم التسليم — بانتظار الاستلام",
  receipt: "تم الاستلام — بانتظار شهادة الإنجاز",
  drawing: "باقي الرسم (GIS)",
  invoice: "دخلت مستخلص ولم تُصرف",
};

export function projectsFrom(d: any) {
  const rows = (d.items || []).map((i: any) => ({
    wo: i.wo, type: i.type || "", status: STAGE[i.stage] || i.stage, note: i.status || "",
    owner: i.owner || "", plan: i.plan || "", consultant: i.consultant || "",
    delivered: i.delivered || null, received: i.received || null, cert: i.cert || null, abstractDate: i.abstractDate || null,
    amount: typeof i.amount === "number" ? Math.round(i.amount * 100) / 100 : null,
  }));
  return { asof: (d.source?.builtAt || "").slice(0, 10) || today(), source: d.source?.file || "mainoffice-wo-report", rows };
}

export function scheduleFrom(items: any[]) {
  // صفوف اليوم تأتي متتالية، والموقع مكتوب في أول صف من كل موقع فقط: نملؤه للصفوف التالية.
  const m = new Map<string, any>();
  let lastDate = "", loc = "";
  for (const r of items) {
    if (r.date !== lastDate) { lastDate = r.date; loc = ""; }
    if (r.location) loc = r.location;
    const site = loc || "غير محدد";
    const k = r.date + "|" + site;
    if (!m.has(k)) m.set(k, { date: r.date, site, items: 0, value: 0, status: "منفذ" });
    const g = m.get(k); g.items += 1; g.value += Number(r.total) || 0;
  }
  const rows = [...m.values()].map((g) => ({ ...g, value: Math.round(g.value) }));
  const last = rows.reduce((a, r) => (r.date > a ? r.date : a), "");
  return { asof: last || today(), source: "najran-wabran-dor-dashboard", rows };
}

const CAT: Record<string, string> = {
  paid: "محصّلة", rejected_deleted: "ملغاة / محذوفة",
  finance_hold: "عند المالية", needs_approval: "تحتاج اعتماد", archived: "مؤرشفة — بانتظار الصرف",
  no_entry_sheet: "لا توجد صحيفة إدخال", sap_issue: "مشكلة في ساب", missing_docs: "مستندات ناقصة",
  needs_archive: "تحتاج أرشفة", needs_rearchive: "تحتاج إعادة أرشفة", scrap_gis: "سكراب / GIS", entry_error: "خطأ إدخال",
  no_note: "بلا ملاحظة", unclassified: "غير مصنفة", needs_review: "تحتاج مراجعة",
};
export function invoicesFrom(list: any[]) {
  const rows = list.map((r) => ({
    no: r.invoice_no, date: r.invoice_date, type: r.invoice_type || "", statement: r.statement_no || "",
    net: r.amount_before_vat, vat: r.vat_amount, penalty: r.penalty_amount || 0, total: r.net_amount,
    paid: r.collection_date, note: r.note || "", status: CAT[r.note_category] || r.note_category || "بلا ملاحظة",
  }));
  return { asof: today(), source: "najran-invoice-intelligence", rows };
}

// منصة المشاريع الكبيرة: آخر تقرير مرفوع في najran-projects-dashboard (ورقة «مشاريع اكبر من 100»)
const isoDMY = (v: any) => {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
  const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`; }
  const k = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return k ? k[0] : null;
};
const num = (v: any) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const txt = (v: any) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
// خطة التحصيل (أول جدول في ورقة «خطة تحصيل محتملة»): مراحل التحصيل بقيمها ومشاريعها
function collectionsFrom(rep: any) {
  const b = rep.collections_data?.blocks?.[0];
  if (!b) return null;
  const cols = (b.columns || []).filter((c: any) => /مرحلة/.test(String(c.label || "")));
  const clean = (t: any) => String(t || "").replace(/\s+/g, " ").trim();
  const n = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
  const rows = (b.rows || []).filter((r: any) => /^\d{6,}$/.test(String(r.cells?.B ?? "").trim())).map((r: any) => {
    const c = r.cells || {}; const st: Record<string, number> = {};
    cols.forEach((x: any) => { if (n(c[x.col])) st[x.col] = n(c[x.col]); });
    return { wo: String(c.B), name: clean(c.C), partial: n(c.D), stages: st, note: clean(c.J), gis: clean(c.K) };
  });
  const stages = cols.map((x: any) => ({ col: x.col, label: clean(x.label), total: rows.reduce((t: number, r: any) => t + (r.stages[x.col] || 0), 0), count: rows.filter((r: any) => r.stages[x.col]).length }));
  return { title: clean(b.title), stages, rows, total: stages.reduce((t: number, s: any) => t + s.total, 0) };
}

export function bigProjectsFrom(rep: any) {
  const pj = rep.projects_data || {};
  const rows = (pj.rows || []).filter((r: any) => /^\d{6,}$/.test(String(r.cells?.B ?? "").trim())).map((r: any) => {
    const c = r.cells || {};
    return {
      wo: String(c.B), type: txt(c.C), received: isoDMY(c.D), invoice: num(c.E), name: txt(c.F), status: txt(c.G) || "غير محدد",
      estCost: num(c.H), actCost: num(c.I), pct: c.J == null ? null : Math.round(Number(c.J) * 1000) / 10, delivered: isoDMY(c.K),
      // العمود L «قيمة الصرف (جزئي/نهائي)» يُوزَّع حسب «موقف صرف المستخلص» (P)؛ العمود N يُستخدم إن وُجدت فيه قيمة
      partial: /جزئي/.test(txt(c.P)) ? num(c.L) : 0, certDate: isoDMY(c.M),
      final: num(c.N) || (/نهائي/.test(txt(c.P)) ? num(c.L) : 0), paid: num(c.L), extract: txt(c.O), payStatus: txt(c.P), materials: txt(c.Q),
      remaining: txt(c.R), finished: txt(c.S), uds: txt(c.T),
    };
  });
  return { asof: rep.report_date || new Date().toISOString().slice(0, 10), source: rep.file_name || "najran-projects-dashboard", uploadedAt: rep.uploaded_at || null, title: pj.title || "", rows, collections: collectionsFrom(rep) };
}

// تحديث فوري لمنصة المشاريع الكبيرة من آخر تقرير مرفوع (عند فتحها في البوابة)
export async function syncBigProjects() {
  const store = getStore({ name: "wabran-hub", consistency: "strong" });
  const B = "https://najran-projects-dashboard.netlify.app/api/reports";
  const list = await getJSON(B);
  if (!Array.isArray(list) || !list.length) throw new Error("لا توجد تقارير مرفوعة في منصة المشاريع الكبيرة");
  const latest = list.slice().sort((a: any, b: any) => String(b.report_date + b.uploaded_at).localeCompare(String(a.report_date + a.uploaded_at)))[0];
  const cur: any = await store.get("ds_bigprojects", { type: "json" });
  if (cur && cur.uploadedAt && cur.uploadedAt === latest.uploaded_at && cur.rows?.[0] && "paid" in cur.rows[0] && cur.collections) return { asof: cur.asof, changed: false };
  const ds: any = bigProjectsFrom(await getJSON(B + "?id=" + encodeURIComponent(latest.id)));
  if (!ds.rows.length) throw new Error("التقرير بلا صفوف");
  ds.syncedAt = new Date().toISOString();
  await store.setJSON("ds_bigprojects", ds);
  return { asof: ds.asof, changed: true };
}

async function getJSON(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

export async function runSync() {
  const store = getStore({ name: "wabran-hub", consistency: "strong" });
  const report: Record<string, string> = {};
  const jobs: [string, () => Promise<any>][] = [
    ["bigprojects", async () => {
      const B = "https://najran-projects-dashboard.netlify.app/api/reports";
      const list = await getJSON(B);
      if (!Array.isArray(list) || !list.length) throw new Error("لا توجد تقارير مرفوعة في منصة المشاريع الكبيرة");
      const latest = list.slice().sort((a: any, b: any) => String(b.report_date + b.uploaded_at).localeCompare(String(a.report_date + a.uploaded_at)))[0];
      return bigProjectsFrom(await getJSON(B + "?id=" + encodeURIComponent(latest.id)));
    }],
    ["projects", async () => projectsFrom(await getJSON("https://mainoffice-wo-report.netlify.app/api/data"))],
    ["schedule", async () => scheduleFrom(await getJSON("https://najran-wabran-dor-dashboard.netlify.app/seed_items.json"))],
    ["invoices", async () => {
      const key = Netlify.env.get("INVOICES_SUPABASE_KEY");
      if (!key) throw new Error("INVOICES_SUPABASE_KEY غير مضبوط");
      const h = { apikey: key, Authorization: `Bearer ${key}` };
      const all: any[] = [];
      for (let off = 0; off < 20000; off += 1000) {
        const page = await getJSON(`https://kvzoiqlhtqdqliedhzie.supabase.co/rest/v1/invoices?select=*&order=id&offset=${off}&limit=1000`, h);
        all.push(...page); if (page.length < 1000) break;
      }
      return invoicesFrom(all);
    }],
  ];
  for (const [id, fn] of jobs) {
    try {
      const ds = await fn();
      if (!ds.rows.length) throw new Error("المصدر أعاد صفر سجلات — لم أستبدل البيانات الحالية");
      // جدول الأعمال: النسخة المرفوعة من متصفح المنصة الأصلية أحدث من ملف الأساس الثابت؛ لا نستبدلها بأقدم منها
      if (id === "schedule") {
        const cur: any = await store.get("ds_schedule", { type: "json" });
        if (cur && cur.monthly && String(cur.asof || "") >= String(ds.asof || "")) { report[id] = `kept ${cur.rows?.length || 0} (المنصة حتى ${cur.asof})`; continue; }
      }
      ds.syncedAt = new Date().toISOString();
      await store.setJSON("ds_" + id, ds);
      report[id] = `ok ${ds.rows.length}`;
    } catch (e) {
      report[id] = "error: " + String((e as Error).message || e).slice(0, 200);
    }
  }
  await store.setJSON("sync", { at: new Date().toISOString(), report });
  return report;
}
