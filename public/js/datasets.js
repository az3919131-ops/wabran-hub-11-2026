/*
  محرك لوحات المنصات الخمس الأولى.
  كل منصة لها "مخطط بيانات": أعمدتها (تُكتشف من العناوين بالعربي أو الإنجليزي)، تصنيف الحالة،
  الأبعاد التي تُحلل بها، وتاريخ الاستحقاق. البيانات تأتي من ملف Excel/CSV أو جدول منسوخ من المنصة الأصلية،
  وتُحفظ في القاعدة المشتركة بمفتاح ds_<id>، ثم تُبنى منها اللوحة التحليلية والتنبيهات تلقائياً.
*/
(function () {
  "use strict";
  const { U } = HUB;

  // أنواع التصنيف: done منجز، active جارٍ، pending لم يبدأ/معلق، problem متعثر، cancel ملغي
  const C = (label, kind) => ({ label, kind });

  const SCHEMAS = {
    projects: {
      unit: "أمر عمل", origin: "أوامر عمل المشاريع من «منصة مستهدف الإنشاءات والمشاريع»",
      cols: {
        wo: { label: "رقم أمر العمل", kw: ["امر العمل", "أمر العمل", "work order", "wo"], key: true },
        type: { label: "نوع العمل", kw: ["نوع", "type"] },
        status: { label: "المرحلة", kw: ["المرحلة", "stage", "الحالة"] },
        note: { label: "الموقف", kw: ["الموقف", "ملاحظات", "status", "note"] },
        owner: { label: "المتابع", kw: ["المتابع", "المسؤول", "owner"] },
        plan: { label: "المتبقي", kw: ["المتبقي", "الاجراء", "plan"] },
        consultant: { label: "الاستشاري", kw: ["الاستشاري", "consultant"] },
        delivered: { label: "تاريخ التسليم", kw: ["تاريخ التسليم", "التسليم", "delivered"], type: "date" },
        received: { label: "تاريخ الاستلام", kw: ["تاريخ الاستلام", "الاستلام", "received"], type: "date" },
        cert: { label: "تاريخ الشهادة", kw: ["الشهادة", "cert"], type: "date" },
        amount: { label: "القيمة (ريال)", kw: ["القيمة", "المبلغ", "amount", "value"], type: "num" },
      },
      classes: { delivery: C("تم التسليم — بانتظار الاستلام", "pending"), receipt: C("تم الاستلام — بانتظار شهادة الإنجاز", "active"), drawing: C("باقي الرسم (GIS)", "active"), invoice: C("دخلت مستخلص ولم تُصرف", "active"), closed: C("مغلق ومصروف", "done") },
      classify(t) {
        if (/مستخلص/.test(t)) return "invoice";
        if (/رسم|gis/i.test(t)) return "drawing";
        if (/استلام|receipt/i.test(t)) return t.includes("بانتظار الاستلام") ? "delivery" : "receipt";
        if (/صرف|مغلق|closed/i.test(t)) return "closed";
        return "delivery";
      },
      dateKey: "delivered", amountKey: "amount", sla: 365, slaText: "مضى على تسليمها أكثر من 365 يوماً",
      dims: [["owner", "المتابع"], ["plan", "المتبقي"], ["type", "نوع العمل"], ["consultant", "الاستشاري"]],
      score: "notLate",
      title: (r) => r.type || "",
    },
    schedule: {
      unit: "يوم عمل", origin: "تقارير الإنتاج اليومية من منصة «جدول الأعمال»",
      cols: {
        date: { label: "التاريخ", kw: ["التاريخ", "اليوم", "date"], type: "date" },
        site: { label: "الموقع", kw: ["الموقع", "الحي", "site", "location"] },
        items: { label: "عدد البنود", kw: ["عدد البنود", "البنود", "items"], type: "num" },
        value: { label: "قيمة المنفذ (ريال)", kw: ["القيمة", "الاجمالي", "الإجمالي", "total", "value"], type: "num" },
        status: { label: "الحالة", kw: ["الحالة", "status"] },
      },
      classes: { done: C("منفذ", "done"), plan: C("مخطط", "pending"), not: C("لم ينفذ", "problem") },
      classify(t) { if (/لم|not/i.test(t)) return "not"; if (/مخطط|plan/i.test(t)) return "plan"; return "done"; },
      dateKey: "date", amountKey: "value", sla: 0,
      dims: [["site", "الموقع"]],
      score: "cadence",
      title: (r) => r.site || "",
    },
    invoices: {
      unit: "فاتورة", origin: "الفواتير الضريبية من منصة «تحليل الفواتير»",
      cols: {
        no: { label: "رقم الفاتورة", kw: ["رقم الفاتورة", "الفاتورة", "invoice"], key: true },
        date: { label: "تاريخ الفاتورة", kw: ["تاريخ الفاتورة", "التاريخ", "date"], type: "date" },
        type: { label: "نوع الفاتورة", kw: ["نوع", "type"] },
        statement: { label: "رقم الصحيفة", kw: ["الصحيفة", "المستخلص", "statement"] },
        net: { label: "قبل الضريبة", kw: ["قبل الضريبة", "net", "subtotal"], type: "num" },
        vat: { label: "الضريبة", kw: ["الضريبة", "vat"], type: "num" },
        penalty: { label: "الغرامات", kw: ["غرام", "penalty"], type: "num" },
        total: { label: "الصافي (ريال)", kw: ["الصافي", "الإجمالي", "الاجمالي", "total"], type: "num" },
        paid: { label: "تاريخ التحصيل", kw: ["تاريخ التحصيل", "التحصيل", "السداد", "collection"], type: "date" },
        status: { label: "التصنيف", kw: ["التصنيف", "الحالة", "category", "status"] },
        note: { label: "الملاحظة", kw: ["الملاحظة", "ملاحظات", "note"] },
      },
      classes: { paid: C("محصّلة", "done"), finance: C("عند المالية / الاعتماد", "active"), docs: C("ناقصة مستندات أو أرشفة أو ساب", "problem"), open: C("لم تُحصّل — بلا سبب مسجل", "pending"), cancel: C("ملغاة", "cancel") },
      classify(t, r) {
        if (/ملغ|محذوف|cancel/i.test(t)) return "cancel";
        if (/محصل|محصّل|مدفوع|paid/i.test(t) || r.paid) return "paid";
        if (/المالية|اعتماد|مؤرشفة/.test(t)) return "finance";
        if (/صحيفة|ساب|مستندات|أرشفة|ارشفة|سكراب|خطأ/.test(t)) return "docs";
        return "open";
      },
      dateKey: "date", amountKey: "total", sla: 60, slaText: "صدرت منذ أكثر من 60 يوماً ولم تُحصّل",
      dims: [["status", "سبب عدم التحصيل"], ["type", "نوع الفاتورة"]],
      dimsOpenOnly: true,
      score: "amountDone",
      title: (r) => [r.type, r.note].filter(Boolean).join(" · "),
    },
    assign: {
      unit: "أمر عمل", origin: "أوامر العمل من منصة «مركز التحكم بأوامر العمل»",
      cols: {
        wo: { label: "رقم أمر العمل", kw: ["امر العمل", "أمر العمل", "work order", "wo"], key: true },
        status: { label: "حالة الأمر", kw: ["الحالة", "status"] },
        type: { label: "نوع العمل", kw: ["نوع", "type"] },
        office: { label: "المكتب", kw: ["المكتب", "office"] },
        received: { label: "تاريخ الاستلام", kw: ["تاريخ الاستلام", "received"], type: "date" },
        delivered: { label: "تاريخ التسليم للمقاول", kw: ["تاريخ التسليم", "delivered"], type: "date" },
        planned: { label: "الإنجاز المخطط", kw: ["المخطط", "planned"], type: "date" },
        extract: { label: "تاريخ المستخلص", kw: ["المستخلص", "extract"], type: "date" },
        value: { label: "القيمة (ريال)", kw: ["القيمة", "value", "amount"], type: "num" },
        owner: { label: "المتابع", kw: ["المتابع", "owner"] },
      },
      classes: { done: C("منتهي ومصروف", "done"), extract: C("دخلت مستخلص ولم تُصرف", "active"), confirmed: C("مؤكد ولم يدخل مستخلص", "active"), cert: C("بانتظار شهادة الإنجاز أو اعتمادها", "pending"), field: C("لدى المقاول — لم يُستلم", "problem") },
      classify(t) {
        if (t === "منتهي" || /تم الصرف/.test(t)) return "done";
        if (/مستخلص ولم تصرف/.test(t)) return "extract";
        if (/مؤكد/.test(t)) return "confirmed";
        if (/تسليم المقاول ولم يتم الاستلام/.test(t)) return "field";
        return "cert";
      },
      dateKey: "delivered", amountKey: "value", sla: 365, slaText: "مضى على تسليمها للمقاول أكثر من 365 يوماً",
      dims: [["type", "نوع العمل"], ["office", "المكتب"], ["owner", "المتابع"]],
      score: "notLate",
      title: (r) => [r.type, r.office].filter(Boolean).join(" · "),
    },
    dispatch: {
      unit: "مهمة", origin: "لوحة التوزيع اليومي",
      note: "منصة التوزيع اليومي تحفظ خططها داخل متصفح كل مستخدم ولا تملك قاعدة بيانات على الخادم، فلا يمكن سحب بياناتها تلقائياً. صدّر الخطة أو انسخ جدولها والصقه هنا.",
      cols: {
        date: { label: "التاريخ", kw: ["التاريخ", "اليوم", "date"], type: "date" },
        crew: { label: "الفريق", kw: ["الفريق", "الفرقة", "crew", "team"] },
        leader: { label: "رئيس الفريق", kw: ["رئيس", "المسؤول", "leader", "foreman"] },
        site: { label: "الموقع", kw: ["الموقع", "الحي", "site", "location"] },
        task: { label: "المهمة", kw: ["المهمة", "العمل", "الوصف", "task"] },
        wo: { label: "أمر العمل", kw: ["امر العمل", "أمر العمل", "work order", "wo"] },
        vehicle: { label: "المعدة / السيارة", kw: ["المعدة", "السيارة", "vehicle", "equipment"] },
        status: { label: "الحالة", kw: ["الحالة", "status"] },
      },
      classes: { done: C("منجزة", "done"), prog: C("جارية", "active"), plan: C("مخططة", "pending"), not: C("لم تنجز", "problem"), cancel: C("ملغاة", "cancel") },
      classify(t) {
        if (/ملغ|cancel/i.test(t)) return "cancel";
        if (/لم|غير|not/i.test(t)) return "not";
        if (/منجز|منفذ|تم|done|complete/i.test(t)) return "done";
        if (/جاري|تنفيذ|progress/i.test(t)) return "prog";
        return "plan";
      },
      dateKey: "date", dueKey: "date", sla: 0,
      dims: [["crew", "الفريق"], ["site", "الموقع"], ["leader", "رئيس الفريق"], ["vehicle", "المعدة"]],
      score: "pastDone",
      title: (r) => r.task || r.site || "",
    },
  };
  const AUTO = { projects: true, schedule: true, invoices: true };

  /* ---------- قراءة الملف أو الجدول المنسوخ ---------- */
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
  function cellDate(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date) { const t = new Date(v.getTime() + 12 * 36e5); return U.iso(new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
    if (typeof v === "number" && v > 20000 && v < 80000) return U.iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5 + 12 * 36e5));
    const s = U.toEn(v).trim();
    let k = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if (k) return U.iso(new Date(+k[1], +k[2] - 1, +k[3]));
    k = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (k) { let y = +k[3]; if (y < 100) y += 2000; return U.iso(new Date(y, +k[2] - 1, +k[1])); }
    k = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2,4})$/);
    if (k) { const m = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(k[2].slice(0, 3).toLowerCase()); if (m >= 0) { let y = +k[3]; if (y < 100) y += 2000; return U.iso(new Date(y, m, +k[1])); } }
    return null;
  }
  function cellNum(v) { if (typeof v === "number") return v; const s = U.toEn(v).replace(/[,٬\s]|ريال|sar/gi, "").replace("٫", "."); if (s === "" || isNaN(+s)) return null; return +s; }

  function mapColumns(header, schema) {
    const h = header.map(norm), col = {};
    const used = new Set();
    // الأعمدة ذات الكلمات الأطول أولاً حتى لا يأخذ "التاريخ" عمود "تاريخ الإغلاق"
    const order = Object.entries(schema.cols).flatMap(([k, c]) => c.kw.map((w) => [k, norm(w)])).sort((a, b) => b[1].length - a[1].length);
    for (const [k, w] of order) {
      if (col[k] != null) continue;
      const i = h.findIndex((x, j) => !used.has(j) && x && (w.length <= 3 ? x === w || x.split(" ").includes(w) : x.includes(w)));
      if (i >= 0) { col[k] = i; used.add(i); }
    }
    return col;
  }
  function parseRows(rows, id) {
    const schema = SCHEMAS[id];
    let hi = -1, best = 0, col = {};
    rows.slice(0, 20).forEach((r, i) => { const c = mapColumns(r, schema); const n = Object.keys(c).length; if (n > best) { best = n; hi = i; col = c; } });
    if (best < 2) throw new Error("لم أتعرف على صف العناوين. نزّل النموذج لترى أسماء الأعمدة المطلوبة.");
    const out = [];
    rows.slice(hi + 1).forEach((r) => {
      if (!r || r.every((c) => c === "" || c == null)) return;
      const rec = {};
      Object.entries(col).forEach(([k, i]) => {
        const t = schema.cols[k].type, v = r[i];
        rec[k] = t === "date" ? cellDate(v) : t === "num" ? cellNum(v) : String(v ?? "").trim();
      });
      if (schema.fill) schema.fill(rec);
      if (Object.values(rec).filter((v) => v !== "" && v != null).length < 2) return;
      out.push(rec);
    });
    const missing = Object.entries(schema.cols).filter(([k]) => col[k] == null).map(([, c]) => c.label);
    return { rows: out, mapped: Object.keys(col).map((k) => schema.cols[k].label), missing };
  }
  function parseFile(buf, id) {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    let best = null;
    for (const n of wb.SheetNames) {
      try { const r = parseRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }), id); if (!best || r.rows.length > best.rows.length) best = { ...r, sheet: n }; } catch (e) {}
    }
    if (!best) throw new Error("لم أجد في أي ورقة صف عناوين مطابقاً. نزّل النموذج لترى أسماء الأعمدة المطلوبة.");
    return best;
  }
  function parsePaste(text, id) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    return parseRows(lines.map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim())), id);
  }
  function template(id) {
    const s = SCHEMAS[id];
    return [Object.values(s.cols).map((c) => c.label)];
  }

  /* ---------- التحليل ---------- */
  // السجل المجمّع (_n) يمثل عدة أوامر منتهية لتخفيف الحجم؛ كل العدّ يتم بالوزن.
  const W = (arr) => arr.reduce((a, r) => a + (r._n || 1), 0);
  function analyze(id, ds) {
    const s = SCHEMAS[id], today = U.today(), todayIso = U.iso(today);
    const rows = (ds && ds.rows ? ds.rows : []).map((r) => {
      const cls = s.classify(String(r.status || ""), r);
      const kind = (s.classes[cls] || { kind: "pending" }).kind;
      const base = r[s.dateKey];
      const age = base ? U.daysFrom(base) : null;
      let lateBy = null;
      if (kind !== "done" && kind !== "cancel") {
        if (s.dueKey && r[s.dueKey]) { const d = U.daysFrom(r[s.dueKey]); if (d > 0) lateBy = d; }
        else if (s.sla && age != null && age > s.sla) lateBy = age - s.sla;
      }
      return { ...r, cls, kind, age, lateBy };
    });
    const live = rows.filter((r) => r.kind !== "cancel");
    const done = live.filter((r) => r.kind === "done");
    const open = live.filter((r) => r.kind !== "done");
    const late = live.filter((r) => r.lateBy > 0).sort((a, b) => b.lateBy - a.lateBy);
    const sum = (arr) => (s.amountKey ? arr.reduce((a, r) => a + (Number(r[s.amountKey]) || 0), 0) : null);
    const byCls = Object.keys(s.classes).map((k) => { const a = rows.filter((r) => r.cls === k); return { k, ...s.classes[k], n: W(a), amt: sum(a) }; }).filter((x) => x.n);
    const dimBase = s.dimsOpenOnly ? open : live;
    const dims = s.dims.map(([k, label]) => {
      const m = new Map();
      dimBase.forEach((r) => { const n = r[k] || "غير محدد"; if (!m.has(n)) m.set(n, []); m.get(n).push(r); });
      const g = [...m].map(([name, a]) => ({ name, total: W(a), done: W(a.filter((r) => r.kind === "done")), late: W(a.filter((r) => r.lateBy > 0)), amt: sum(a) })).sort((x, y) => y.late - x.late || (s.amountKey && id !== "projects" && id !== "assign" ? (y.amt || 0) - (x.amt || 0) : y.total - x.total));
      return { k, label, groups: g, has: dimBase.some((r) => r[k]) };
    }).filter((d) => d.has);
    const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); const key = U.iso(d).slice(0, 7); const a = live.filter((r) => String(r[s.dateKey] || "").startsWith(key)); months.push({ key, label: U.month(d.getMonth()), n: W(a), done: W(a.filter((r) => r.kind === "done")), amt: sum(a) }); }
    const todays = live.filter((r) => r[s.dateKey] === todayIso);
    // أيام العمل المسجلة خلال آخر 30 يوماً (لتقارير الإنتاج)
    const d30 = U.iso(new Date(today.getTime() - 30 * 864e5));
    const days30 = new Set(live.filter((r) => r[s.dateKey] > d30 && r[s.dateKey] <= todayIso).map((r) => r[s.dateKey])).size;
    let score = null;
    if (s.score === "amountDone") { const t = sum(live), p = sum(done); score = t > 0 ? Math.round((p / t) * 100) : null; }
    else if (s.score === "notLate") score = W(open) ? Math.round((1 - W(late) / W(open)) * 100) : 100;
    else if (s.score === "cadence") score = Math.min(100, Math.round((days30 / 26) * 100));
    else if (s.score === "pastDone") { const past = live.filter((r) => r[s.dateKey] && r[s.dateKey] <= todayIso); score = W(past) ? Math.round((W(past.filter((r) => r.kind === "done")) / W(past)) * 100) : null; }
    else score = W(live) ? Math.round((W(done) / W(live)) * 100) : null;
    const level = score == null ? "none" : score >= 80 ? "ok" : score >= 55 ? "warn" : "bad";
    return { s, rows, live, done, open, late, byCls, dims, months, todays, days30, score, level, sum, W, total: sum(live), doneAmt: sum(done) };
  }

  /* ---------- تقييم المنصة للرئيسية والمساعد ---------- */
  function evaluate(p, ds, out) {
    const A = analyze(p.id, ds), name = p.name, s = A.s;
    out.score = A.score; out.level = A.level;
    const age = U.daysFrom(ds.asof);
    if (p.id === "invoices") {
      const pend = A.total - A.doneAmt;
      out.fig = U.fmt(Math.round(pend)); out.figLabel = "ريال غير محصّل";
      out.issue = `نسبة التحصيل ${A.score ?? "—"}% من ${U.fmt(Math.round(A.total))} ريال، و${A.W(A.open)} فاتورة لم تُحصّل` + (A.late.length ? ` منها ${A.W(A.late)} أقدم من ${s.sla} يوماً` : "");
    } else if (p.id === "schedule") {
      const m = A.months[A.months.length - 1], pm = A.months[A.months.length - 2];
      const per = HUB.S.period;
      if (per && per.months) {
        // الفترة مختارة: قيمة أعمال الشهر، أو المتوسط الشهري لأشهر الفترة
        const v = A.total / per.months;
        out.fig = U.fmt(Math.round(v));
        out.figLabel = per.months === 1 ? "ريال قيمة أعمال آخر شهر" : `ريال متوسط شهري (${per.months} أشهر)`;
      } else {
        // كل الفترات: متوسط آخر 3 أشهر فيها أعمال مسجلة
        const byM = new Map();
        A.live.forEach((r) => { const k = String(r.date || "").slice(0, 7); if (k) byM.set(k, (byM.get(k) || 0) + (Number(r.value) || 0)); });
        const last3 = [...byM].filter(([, v]) => v > 0).sort((x, y) => (x[0] < y[0] ? 1 : -1)).slice(0, 3);
        const avg = last3.length ? last3.reduce((t, [, v]) => t + v, 0) / last3.length : 0;
        const nm = (k) => U.month(+k.slice(5, 7) - 1);
        out.fig = U.fmt(Math.round(avg));
        out.figLabel = last3.length ? `ريال متوسط شهري لآخر ${last3.length === 3 ? "3 أشهر" : last3.length + " شهر"} (${nm(last3[last3.length - 1][0])}–${nm(last3[0][0])})` : "ريال";
      }
      out.issue = `${U.days(A.days30)} عمل مسجلة في آخر 30 يوماً، والشهر السابق ${U.fmt(Math.round(pm.amt))} ريال`;
    } else if (p.id === "dispatch") {
      out.fig = String(A.todays.length); out.figLabel = "مهمة اليوم";
      out.issue = `الإنجاز ${A.score ?? "—"}% من المخطط حتى اليوم`;
    } else {
      out.fig = U.fmt(A.W(A.open)); out.figLabel = `${s.unit} مفتوح` + (s.amountKey ? ` بقيمة ${U.fmt(Math.round(A.sum(A.open)))} ريال` : "");
      out.issue = A.late.length ? `${A.W(A.late)} ${s.slaText}، أقدمها ${U.days(A.late[0].lateBy + (s.sla || 0))}` : "لا متأخرات";
    }
    if (A.late.length && p.id !== "schedule") out.alerts.push({ level: A.level === "bad" ? "bad" : "warn", text: `${name}: ${A.W(A.late)} ${s.unit} ${s.slaText || "متأخر"}` + (s.amountKey ? ` (${U.fmt(Math.round(A.sum(A.late)))} ريال)` : ""), app: p.id, tab: "late" });
    A.byCls.filter((c) => c.kind === "problem").forEach((c) => out.alerts.push({ level: "warn", text: `${name}: ${c.n} ${c.label}` + (c.amt ? ` (${U.fmt(Math.round(c.amt))} ريال)` : ""), app: p.id, tab: "all" }));
    if (p.id === "schedule" && A.days30 < 18) out.alerts.push({ level: "warn", text: `${name}: ${U.days(A.days30)} عمل فقط مسجلة في آخر 30 يوماً`, app: p.id, tab: "overview" });
    const lim = p.id === "schedule" ? 7 : 3;
    if (age > lim) out.gaps.push({ level: "warn", text: `${name}: آخر بيانات بتاريخ ${U.dmy(ds.asof)} (منذ ${U.days(age)})${AUTO[p.id] ? " — المصدر نفسه لم يُحدّث" : ""}`, app: p.id, tab: "data" });
    return A;
  }

  /* ---------- سياق المساعد ---------- */
  const ak0 = (A, x) => (A.s.amountKey ? ` (${U.fmt(Math.round(A.sum(x)))} ريال)` : "");
  function context(p, ds) {
    const A = analyze(p.id, ds), s = A.s, L = [];
    L.push(`\n## ${p.name} (بيانات بتاريخ ${ds.asof}، ${A.W(A.rows)} ${s.unit})`);
    L.push(`الحالات: ` + A.byCls.map((c) => `${c.label}=${c.n}${c.amt != null ? " (" + U.fmt(Math.round(c.amt)) + " ريال)" : ""}`).join("، "));
    L.push(`شهرياً: ` + A.months.map((m) => `${m.key}: ${m.n}${m.amt != null ? " / " + U.fmt(Math.round(m.amt)) + " ريال" : ""}`).join("؛ "));
    if (A.open.length && p.id !== "schedule") { const B = [[0, 90], [90, 365], [365, 1095], [1095, 1e9]]; L.push(`عمر المفتوح: ` + B.map(([a, b]) => { const x = A.open.filter((r) => r.age != null && r.age >= a && r.age < b); return `${a}-${b === 1e9 ? "∞" : b} يوم: ${A.W(x)}${ak0(A, x)}`; }).join("؛ ")); }
    A.dims.forEach((d) => L.push(`حسب ${d.label}: ` + d.groups.slice(0, 15).map((g) => `${g.name}: ${g.total} (منجز ${g.done}، متأخر ${g.late}${g.amt != null ? "، " + U.fmt(Math.round(g.amt)) + " ريال" : ""})`).join("؛ ")));
    const keys = Object.keys(s.cols).filter((k) => k !== "status" || p.id !== "schedule");
    const ak = s.amountKey;
    // أهم 60 سجلاً مفتوحاً: الأعلى قيمة ثم الأقدم. الأرقام الكاملة في الملخصات أعلاه.
    const list = p.id === "schedule" ? A.rows.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40)
      : A.open.filter((r) => !r._n).sort((a, b) => (ak ? (Number(b[ak]) || 0) - (Number(a[ak]) || 0) : 0) || (b.age || 0) - (a.age || 0)).slice(0, 60);
    L.push(`${p.id === "schedule" ? "آخر 40 يوم عمل" : "أهم 60 سجلاً مفتوحاً (الأعلى قيمة)"} (${keys.join("|")}|العمر بالأيام):`);
    list.forEach((r) => L.push(keys.map((k) => String(r[k] ?? "").slice(0, 70)).join("|") + "|" + (r.age ?? "")));
    return L.join("\n");
  }

  window.DS = { SCHEMAS, AUTO, parseFile, parsePaste, template, analyze, evaluate, context, has: (id) => !!SCHEMAS[id] };
})();
