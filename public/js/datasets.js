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
      unit: "أمر عمل",
      cols: {
        wo: { label: "رقم أمر العمل", kw: ["امر العمل", "أمر العمل", "رقم الامر", "رقم الأمر", "work order", "wo"], key: true },
        name: { label: "المشروع / الوصف", kw: ["المشروع", "الوصف", "اسم", "project", "description"] },
        type: { label: "نوع العمل", kw: ["نوع", "type", "التصنيف"] },
        area: { label: "الموقع / الحي", kw: ["الموقع", "الحي", "المنطقة", "location", "area", "district"] },
        eng: { label: "المهندس", kw: ["المهندس", "المشرف", "engineer", "supervisor"] },
        status: { label: "الحالة", kw: ["الحالة", "الموقف", "status"] },
        start: { label: "تاريخ الإسناد", kw: ["تاريخ الاسناد", "تاريخ الإسناد", "تاريخ البدء", "تاريخ الاستلام", "start", "issue date"], type: "date" },
        due: { label: "تاريخ الانتهاء المخطط", kw: ["تاريخ الانتهاء", "الانتهاء المخطط", "due", "end date", "finish"], type: "date" },
        closed: { label: "تاريخ الإغلاق", kw: ["تاريخ الاغلاق", "تاريخ الإغلاق", "closing", "closed"], type: "date" },
        value: { label: "القيمة (ريال)", kw: ["القيمة", "المبلغ", "value", "amount", "cost"], type: "num" },
      },
      classes: { closed: C("مغلق", "done"), done: C("منتهي — بانتظار الإغلاق", "active"), prog: C("تحت التنفيذ", "active"), hold: C("متوقف", "problem"), new: C("جديد / لم يبدأ", "pending"), cancel: C("ملغي", "cancel") },
      classify(t) {
        if (/ملغ|cancel/i.test(t)) return "cancel";
        if (/مغلق|اغلاق|إغلاق|closed/i.test(t)) return "closed";
        if (/منته|منجز|اكتمل|complete|finished/i.test(t)) return "done";
        if (/متوقف|معلق|تعثر|hold|stop/i.test(t)) return "hold";
        if (/تنفيذ|جاري|قيد|progress/i.test(t)) return "prog";
        return "new";
      },
      dateKey: "start", dueKey: "due", amountKey: "value", sla: 60,
      dims: [["eng", "المهندس"], ["area", "الموقع"], ["type", "نوع العمل"]],
      title: (r) => r.name || r.area || "",
    },
    schedule: {
      unit: "عمل",
      cols: {
        date: { label: "التاريخ", kw: ["التاريخ", "اليوم", "date"], type: "date" },
        wo: { label: "رقم أمر العمل", kw: ["امر العمل", "أمر العمل", "work order", "wo"] },
        task: { label: "العمل", kw: ["العمل", "المهمة", "البند", "الوصف", "task", "activity"] },
        site: { label: "الموقع", kw: ["الموقع", "الحي", "site", "location"] },
        crew: { label: "الفريق", kw: ["الفريق", "الفرقة", "crew", "team"] },
        eng: { label: "المهندس", kw: ["المهندس", "المشرف", "engineer"] },
        status: { label: "الحالة", kw: ["الحالة", "التنفيذ", "status"] },
        reason: { label: "سبب عدم التنفيذ", kw: ["السبب", "سبب", "ملاحظات", "reason", "remarks"] },
        qty: { label: "الكمية", kw: ["الكمية", "qty", "quantity"], type: "num" },
      },
      classes: { done: C("منفذ", "done"), part: C("منفذ جزئياً", "active"), plan: C("مخطط", "pending"), post: C("مؤجل", "problem"), not: C("لم ينفذ", "problem"), cancel: C("ملغي", "cancel") },
      classify(t) {
        if (/ملغ|cancel/i.test(t)) return "cancel";
        if (/جزئ|partial/i.test(t)) return "part";
        if (/لم ين|غير منفذ|not/i.test(t)) return "not";
        if (/مؤجل|تأجيل|postpon/i.test(t)) return "post";
        if (/منفذ|تم|منجز|done|complete/i.test(t)) return "done";
        return "plan";
      },
      dateKey: "date", dueKey: "date", sla: 0,
      dims: [["crew", "الفريق"], ["eng", "المهندس"], ["site", "الموقع"], ["reason", "سبب عدم التنفيذ"]],
      title: (r) => r.task || r.site || "",
    },
    invoices: {
      unit: "فاتورة",
      cols: {
        no: { label: "رقم الفاتورة", kw: ["رقم الفاتورة", "الفاتورة", "invoice no", "invoice"], key: true },
        date: { label: "تاريخ الفاتورة", kw: ["تاريخ الفاتورة", "التاريخ", "date"], type: "date" },
        wo: { label: "أمر العمل", kw: ["امر العمل", "أمر العمل", "work order", "wo"] },
        party: { label: "الجهة / المستخلص", kw: ["الجهة", "العميل", "المستخلص", "customer", "client"] },
        net: { label: "المبلغ قبل الضريبة", kw: ["قبل الضريبة", "المبلغ", "الصافي", "net", "subtotal"], type: "num" },
        vat: { label: "ضريبة القيمة المضافة", kw: ["الضريبة", "ضريبة", "vat", "tax"], type: "num" },
        total: { label: "الإجمالي", kw: ["الإجمالي", "الاجمالي", "شامل", "total"], type: "num" },
        status: { label: "الحالة", kw: ["الحالة", "السداد", "status"] },
        paid: { label: "تاريخ السداد", kw: ["تاريخ السداد", "تاريخ التحصيل", "paid date", "payment date"], type: "date" },
      },
      classes: { paid: C("محصّلة", "done"), approved: C("معتمدة — بانتظار السداد", "active"), sent: C("مرسلة / تحت المراجعة", "pending"), rejected: C("مرفوضة / عليها ملاحظات", "problem"), cancel: C("ملغاة", "cancel") },
      classify(t) {
        if (/ملغ|cancel/i.test(t)) return "cancel";
        if (/مرفوض|ملاحظ|reject/i.test(t)) return "rejected";
        if (/محصل|مدفوع|سدد|تم السداد|paid/i.test(t)) return "paid";
        if (/معتمد|approved/i.test(t)) return "approved";
        return "sent";
      },
      dateKey: "date", amountKey: "total", sla: 60,
      dims: [["party", "الجهة"], ["status", "الحالة كما في الملف"]],
      title: (r) => r.party || r.wo || "",
      fill(r) { if (r.total == null && r.net != null) r.total = r.net + (r.vat || 0); if (r.vat == null && r.net != null && r.total != null) r.vat = r.total - r.net; },
    },
    assign: {
      unit: "أمر عمل",
      cols: {
        wo: { label: "رقم أمر العمل", kw: ["امر العمل", "أمر العمل", "رقم الامر", "work order", "wo"], key: true },
        type: { label: "نوع العمل", kw: ["نوع", "type"] },
        area: { label: "الموقع", kw: ["الموقع", "الحي", "location", "area"] },
        to: { label: "المسند إليه", kw: ["المسند", "مسند", "المقاول", "الفريق", "assigned", "contractor", "team"] },
        eng: { label: "المهندس", kw: ["المهندس", "المشرف", "engineer"] },
        received: { label: "تاريخ الاستلام", kw: ["تاريخ الاستلام", "الاستلام", "received"], type: "date" },
        assigned: { label: "تاريخ الإسناد", kw: ["تاريخ الاسناد", "تاريخ الإسناد", "assigned date", "assign date"], type: "date" },
        due: { label: "تاريخ الاستحقاق", kw: ["الاستحقاق", "تاريخ الانتهاء", "due"], type: "date" },
        status: { label: "الحالة", kw: ["الحالة", "الموقف", "status"] },
      },
      classes: { done: C("منجز", "done"), prog: C("قيد التنفيذ", "active"), assigned: C("مسند لم يبدأ", "pending"), un: C("غير مسند", "problem"), cancel: C("ملغي", "cancel") },
      classify(t, r) {
        if (/ملغ|cancel/i.test(t)) return "cancel";
        if (/منجز|منته|مغلق|done|complete|closed/i.test(t)) return "done";
        if (/غير مسند|لم يسند|unassigned/i.test(t) || (!t && !r.to)) return "un";
        if (/تنفيذ|جاري|قيد|progress/i.test(t)) return "prog";
        return r.to ? "assigned" : "un";
      },
      dateKey: "received", dueKey: "due", sla: 30,
      dims: [["to", "المسند إليه"], ["eng", "المهندس"], ["type", "نوع العمل"], ["area", "الموقع"]],
      title: (r) => [r.type, r.area].filter(Boolean).join(" · "),
    },
    dispatch: {
      unit: "مهمة",
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
      title: (r) => r.task || r.site || "",
    },
  };

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
  function analyze(id, ds) {
    const s = SCHEMAS[id], today = U.today();
    const rows = (ds && ds.rows ? ds.rows : []).map((r) => {
      const cls = s.classify(String(r.status || ""), r);
      const kind = s.classes[cls].kind;
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
    const late = live.filter((r) => r.lateBy > 0).sort((a, b) => b.lateBy - a.lateBy);
    const sum = (arr) => (s.amountKey ? arr.reduce((a, r) => a + (Number(r[s.amountKey]) || 0), 0) : null);
    const byCls = Object.keys(s.classes).map((k) => ({ k, ...s.classes[k], n: rows.filter((r) => r.cls === k).length, amt: sum(rows.filter((r) => r.cls === k)) })).filter((x) => x.n);
    const dims = s.dims.map(([k, label]) => {
      const m = new Map();
      live.forEach((r) => { const n = r[k] || "غير محدد"; if (!m.has(n)) m.set(n, []); m.get(n).push(r); });
      const g = [...m].map(([name, a]) => ({ name, total: a.length, done: a.filter((r) => r.kind === "done").length, late: a.filter((r) => r.lateBy > 0).length, amt: sum(a) })).sort((x, y) => y.late - x.late || y.total - x.total);
      return { k, label, groups: g, has: live.some((r) => r[k]) };
    }).filter((d) => d.has);
    const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); const key = U.iso(d).slice(0, 7); const a = live.filter((r) => String(r[s.dateKey] || "").startsWith(key)); months.push({ key, label: U.month(d.getMonth()), n: a.length, done: a.filter((r) => r.kind === "done").length, amt: sum(a) }); }
    const todayIso = U.iso(today);
    const todays = live.filter((r) => r[s.dateKey] === todayIso);
    let score;
    if (id === "invoices") { const t = sum(live), p = sum(done); score = t > 0 ? Math.round((p / t) * 100) : null; }
    else if (id === "schedule" || id === "dispatch") { const past = live.filter((r) => r[s.dateKey] && r[s.dateKey] <= todayIso); score = past.length ? Math.round((past.filter((r) => r.kind === "done").length / past.length) * 100) : null; }
    else score = live.length ? Math.round((done.length / live.length) * 100) : null;
    const lateShare = live.length ? late.length / live.length : 0;
    const level = score == null ? "none" : score >= 80 && lateShare < 0.05 ? "ok" : score >= 55 && lateShare < 0.2 ? "warn" : "bad";
    return { s, rows, live, done, late, byCls, dims, months, todays, score, level, sum, total: sum(live), doneAmt: sum(done), unassigned: rows.filter((r) => r.cls === "un").length };
  }

  /* ---------- تقييم المنصة للرئيسية والمساعد ---------- */
  function evaluate(p, ds, out) {
    const A = analyze(p.id, ds), name = p.name, s = A.s;
    out.score = A.score; out.level = A.level;
    const age = U.daysFrom(ds.asof);
    if (p.id === "invoices") {
      const pend = A.total - A.doneAmt;
      out.fig = U.fmt(Math.round(pend)); out.figLabel = "ريال غير محصّل";
      out.issue = `نسبة التحصيل ${A.score ?? "—"}% من ${U.fmt(Math.round(A.total))} ريال` + (A.late.length ? `، و${A.late.length} فاتورة معلقة أكثر من ${s.sla} يوماً` : "");
    } else if (p.id === "schedule" || p.id === "dispatch") {
      out.fig = String(A.todays.length); out.figLabel = s.unit === "مهمة" ? "مهمة اليوم" : "عمل مخطط اليوم";
      out.issue = `الإنجاز ${A.score ?? "—"}% من المخطط حتى اليوم` + (A.late.length ? `، و${A.late.length} لم تُنفذ في موعدها` : "");
    } else {
      out.fig = String(A.live.length - A.done.length); out.figLabel = `${s.unit} مفتوح من ${A.live.length}`;
      out.issue = `نسبة الإنجاز ${A.score ?? "—"}%` + (A.late.length ? `، و${A.late.length} متأخرة، أقدمها ${U.days(A.late[0].lateBy)}` : "") + (A.unassigned ? `، و${A.unassigned} غير مسندة` : "");
    }
    if (A.late.length) out.alerts.push({ level: A.late.length / Math.max(1, A.live.length) > 0.2 ? "bad" : "warn", text: `${name}: ${A.late.length} ${s.unit} متأخر، أقدمها ${s.title(A.late[0]) || A.late[0].wo || ""} (${U.days(A.late[0].lateBy)})`, app: p.id, tab: "late" });
    const prob = A.byCls.filter((c) => c.kind === "problem");
    prob.forEach((c) => out.alerts.push({ level: "warn", text: `${name}: ${c.n} ${c.label}`, app: p.id, tab: "all" }));
    if (age > 3) out.gaps.push({ level: "warn", text: `${name}: آخر تحديث للبيانات ${U.dmy(ds.asof)} (منذ ${U.days(age)})`, app: p.id, tab: "data" });
    if (ds.missing && ds.missing.length) out.gaps.push({ level: "none", text: `${name}: أعمدة غير موجودة في الملف: ${ds.missing.join("، ")}`, app: p.id, tab: "data" });
    const noStatus = A.rows.filter((r) => !r.status).length;
    if (noStatus) out.gaps.push({ level: "none", text: `${name}: ${noStatus} سجلاً بلا حالة`, app: p.id, tab: "all" });
    return A;
  }

  /* ---------- سياق المساعد ---------- */
  function context(p, ds) {
    const A = analyze(p.id, ds), s = A.s, L = [];
    L.push(`\n## ${p.name} (بيانات بتاريخ ${ds.asof}، ${A.rows.length} سجل)`);
    L.push(`الحالات: ` + A.byCls.map((c) => `${c.label}=${c.n}${c.amt != null ? " (" + U.fmt(Math.round(c.amt)) + " ريال)" : ""}`).join("، "));
    A.dims.forEach((d) => L.push(`حسب ${d.label}: ` + d.groups.slice(0, 12).map((g) => `${g.name}: ${g.total} (منجز ${g.done}، متأخر ${g.late})`).join("؛ ")));
    L.push(`المتأخرة: ` + A.late.slice(0, 25).map((r) => `${r.wo || r.no || ""} ${s.title(r)} — ${r.lateBy} يوم — ${r.status || ""}`).join("؛ "));
    const keys = Object.keys(s.cols);
    L.push(`السجلات (${keys.join("|")}):`);
    A.rows.slice(0, 300).forEach((r) => L.push(keys.map((k) => r[k] ?? "").join("|")));
    return L.join("\n");
  }

  window.DS = { SCHEMAS, parseFile, parsePaste, template, analyze, evaluate, context, has: (id) => !!SCHEMAS[id] };
})();
