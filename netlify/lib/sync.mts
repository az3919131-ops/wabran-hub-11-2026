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

async function getJSON(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

export async function runSync() {
  const store = getStore({ name: "wabran-hub", consistency: "strong" });
  const report: Record<string, string> = {};
  const jobs: [string, () => Promise<any>][] = [
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
