/* النواة: أدوات، القاعدة المشتركة، ومحرك التحليل والتنبيهات الذي تستخدمه الصفحات والمساعد. */
(function () {
  "use strict";
  const DAY = 864e5;
  const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  const U = {
    $: (s, r = document) => r.querySelector(s),
    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
    parseISO(s) { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return y ? new Date(y, m - 1, d) : null; },
    iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); },
    daysFrom(s) { const d = U.parseISO(s); return d ? Math.round((U.today() - d) / DAY) : null; },
    dmy(s) { const d = U.parseISO(s); return d ? d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear() : "—"; },
    longDate(d = new Date()) { return d.getDate() + " " + AR_MONTHS[d.getMonth()] + " " + d.getFullYear(); },
    month: (i) => AR_MONTHS[i],
    fmt(n) { return n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-US"); },
    days(n) { n = Math.abs(n); return n === 1 ? "يوم واحد" : n === 2 ? "يومين" : n <= 10 ? n + " أيام" : n + " يوماً"; },
    toEn: (s) => String(s ?? "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)),
    ls: {
      get(k) { try { return JSON.parse(localStorage.getItem("wh_" + k)); } catch (e) { return null; } },
      set(k, v) { try { localStorage.setItem("wh_" + k, JSON.stringify(v)); } catch (e) {} },
    },
  };

  /* ---------- القاعدة المشتركة (Netlify Blobs عبر /api/data) مع نسخة محلية احتياطية ---------- */
  const Store = {
    online: null,
    async get(key) {
      try {
        const r = await fetch("/api/data?key=" + key, { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        Store.online = true;
        if (j.value != null) U.ls.set(key, j.value);
        return j.value ?? U.ls.get(key);
      } catch (e) {
        Store.online = false;
        return U.ls.get(key);
      }
    },
    async put(key, value) {
      U.ls.set(key, value);
      try {
        const r = await fetch("/api/data?key=" + key, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-hub-pin": U.ls.get("pin") || "" },
          body: JSON.stringify(value),
        });
        const j = await r.json().catch(() => ({}));
        if ([400, 401, 413].includes(r.status)) return { ok: false, error: j.error || "تعذّر الحفظ في القاعدة المشتركة (" + r.status + ")" };
        if (!r.ok) { Store.online = false; return { ok: true, shared: false }; }
        Store.online = true;
        return { ok: true, shared: true };
      } catch (e) {
        Store.online = false;
        return { ok: true, shared: false };
      }
    },
  };

  /* ---------- الحالة ---------- */
  const S = { snapshots: {}, licenses: null, cards: null, summary: null, ds: {}, dispatch: null, loaded: false };
  const LINKED = () => REGISTRY.filter((p) => p.kind === "linked").map((p) => p.id);

  async function loadAll() {
    const [snap, lic, cards, summary] = await Promise.all([Store.get("snapshots"), Store.get("licenses"), Store.get("cards"), Store.get("summary")]);
    S.snapshots = snap || {};
    S.licenses = lic && lic.rows ? lic : SEED.licenses;
    S.cards = cards && cards.rows ? cards : SEED.cards;
    S.summary = summary;
    S.dispatch = await Store.get("dispatch");
    const ids = LINKED();
    const dss = await Promise.all(ids.map((id) => Store.get("ds_" + id)));
    ids.forEach((id, i) => { if (dss[i] && dss[i].rows && dss[i].rows.length) S.ds[id] = dss[i]; });
    S.loaded = true;
  }

  /* ---------- الرخص ---------- */
  const LIC_CLS = SEED.licenses.cls;
  LIC_CLS.N8 = { name: "تحت التنفيذ — ضمن مدة الرخصة", short: "تحت التنفيذ (سارية)", order: 8 };
  LIC_CLS.N5.name = "باقي رفع مراحل / صور المراحل / شهادة إتمام";
  function classify(t) {
    t = String(t || "");
    if (t.includes("تم اصدار") && t.includes("اخلاء")) return "N1";
    if (t.includes("تعديل ملاحظات")) return "N2";
    if (t.includes("انتظار سداد")) return "N3";
    if (t.includes("منتهي") || t.includes("صور المراحل") || t.includes("باقي رفع")) return "N5";
    if (t.includes("رفع المراحل")) return "N4";
    if (t.includes("اختبار")) return "N6";
    if (t.includes("تحت التنفيذ") || t.includes("جاري")) return "N7";
    return "N9";
  }
  const LIC_ACT = {
    N1: "تأكيد عدم وجود غرامة وحفظ الشهادة.",
    N2: "تعديل ملاحظات المعدة وإعادة رفعها خلال 48 ساعة ثم طلب الإخلاء.",
    N3: "سداد المبلغ فوراً وتسجيل رقم السداد.",
    N4: "فتح المعاملة في نظام بلدي وتسجيل آخر رد وطلب المعاينة.",
    N5: "رفع المراحل والشهادة اليوم وتسجيل تاريخ الرفع.",
    N6: "استلام تقرير المختبر ورفعه للاستشاري وتحديث الملاحظة.",
    N7: "زيارة الموقع: إن اكتمل يُرفع للإغلاق وإلا يُطلب تمديد رسمي.",
    N8: "متابعة التنفيذ وتجهيز رفع المراحل قبل تاريخ الانتهاء، وطلب تمديد مبكراً إن لزم.",
    N9: "تصنيف الحالة يدوياً ثم تحديد الإجراء.",
  };
  // سبب التأخر حين لا يحمل الملف سبباً مكتوباً
  function licWhy(r, o) {
    const e = U.dmy(r.end), st = r.st, late = `الرخصة منتهية ${e} (متأخرة ${U.days(o)}).`;
    if (r.cls !== "N1" && o <= 0) return `الثابت: "${st}". تنتهي الرخصة ${e} (متبقٍ ${U.days(-o)}) — تُتابع قبل الانتهاء.`;
    return ({ N1: `لا تأخر قائم: "${st}".`, N2: `الثابت: "${st}". ${late} المرجّح: التعديل المطلوب لم يُنفذ أو لم يُعد رفعه.`, N3: `الثابت: الإخلاء ينتظر السداد. ${late}`, N4: `الثابت: "${st}". ${late} المرجّح: ملاحظات على المراحل أو انتظار معاينة.`, N5: `الثابت: "${st}"؛ بقي إجراء إداري. ${late}`, N6: `الثابت: "${st}" ولم تُسجل نتيجة. ${late} المرجّح: تقرير المختبر لم يصل.`, N7: `الثابت: "تحت التنفيذ" بعد انتهاء المدة ولا تمديد مسجل. ${late}`, N9: `حالة غير مصنفة: "${st}". ${late}` })[r.cls] || "";
  }
  function licRows() {
    return (S.licenses.rows || []).map((r) => {
      const over = U.daysFrom(r.end);
      let cls = classify(r.st);
      if (cls === "N7" && over <= 0) cls = "N8";
      const why = r.why && r.cls === cls ? r.why : licWhy({ ...r, cls }, over);
      return { ...r, cls, why, closed: cls === "N1", over, act: LIC_ACT[cls] || LIC_ACT.N9, clsName: (LIC_CLS[cls] || { name: "غير مصنفة" }).name };
    });
  }

  /* ---------- بطاقات السلامة ---------- */
  function cardRows() {
    return (S.cards.rows || []).map((c) => {
      const left = -U.daysFrom(c.exp);
      const st = left < 0 ? "expired" : left <= 7 ? "week" : left <= 30 ? "soon" : "valid";
      return { ...c, left, st };
    }).sort((a, b) => a.left - b.left);
  }
  const CARD_ST = { expired: "منتهية", week: "تنتهي خلال أسبوع", soon: "تنتهي خلال 30 يوماً", valid: "سارية" };

  /* ---------- آخر قراءة لمنصة مرتبطة ---------- */
  function latest(id) {
    const arr = S.snapshots[id] || [];
    return arr.length ? arr[arr.length - 1] : null;
  }

  /* ---------- محرك التقييم: لكل منصة حالة، رقم رئيسي، تنبيهات، ونواقص ---------- */
  function evaluate(p) {
    const out = { id: p.id, name: p.name, short: p.short, level: "none", score: null, fig: "—", figLabel: "", issue: "", alerts: [], gaps: [] };

    if (p.kind === "linked" && S.ds[p.id] && window.DS) {
      DS.evaluate(p, S.ds[p.id], out);
      return out;
    }
    if (p.kind === "linked") {
      const s = latest(p.id);
      if (!s) {
        out.issue = "لا توجد بيانات بعد. ارفع ملف المنصة أو الصق جدولها ليظهر تحليلها هنا.";
        out.gaps.push({ level: "none", text: `${p.name}: لم تُرفع بياناتها بعد`, app: p.id, tab: "data" });
        return out;
      }
      const v = s.values || {};
      const h = p.health(v);
      const age = U.daysFrom(s.date);
      const f0 = p.fields[0];
      out.fig = U.fmt(v[f0.key]);
      out.figLabel = f0.label;
      if (h) { out.level = h.level; out.score = h.score; out.issue = h.text; }
      if (age > 2) out.gaps.push({ level: "warn", text: `${p.name}: آخر قراءة منذ ${U.days(age)} (${U.dmy(s.date)})`, app: p.id, tab: "data" });
      const missing = p.fields.filter((f) => v[f.key] == null || v[f.key] === "").map((f) => f.label);
      if (missing.length) out.gaps.push({ level: "warn", text: `${p.name}: خانات ناقصة في آخر قراءة: ${missing.join("، ")}`, app: p.id, tab: "data" });
      if (h && h.level !== "ok") out.alerts.push({ level: h.level, text: `${p.name}: ${h.text}`, app: p.id, tab: "summary" });
      if (s.note) out.alerts.push({ level: "none", text: `${p.name}: ملاحظة المدخل — ${s.note}`, app: p.id, tab: "summary" });
      return out;
    }

    if (p.id === "licenses") {
      const rows = licRows();
      const open = rows.filter((r) => !r.closed);
      const overdue = open.filter((r) => r.over > 0).sort((a, b) => b.over - a.over);
      const total = rows.length;
      out.score = total ? Math.round(((total - overdue.length) / total) * 100) : null;
      out.level = !total ? "none" : overdue.length === 0 ? "ok" : overdue.some((r) => r.over > 30) ? "bad" : "warn";
      out.fig = String(open.length);
      out.figLabel = "رخصة مفتوحة من " + total;
      out.issue = overdue.length ? `${overdue.length} رخصة مفتوحة تجاوزت مدتها، أقدمها ${overdue[0].loc} (${U.days(overdue[0].over)})` : "لا توجد رخصة مفتوحة متجاوزة";
      const n7 = open.filter((r) => r.cls === "N7" && r.over > 0);
      if (n7.length) out.alerts.push({ level: "bad", text: `الرخص: ${n7.length} تحت التنفيذ بعد انتهاء المدة بلا تمديد (خطر غرامة): ${n7.map((r) => r.loc).join("، ")}`, app: "licenses", tab: "list" });
      const n2 = open.filter((r) => r.cls === "N2");
      if (n2.length) out.alerts.push({ level: "bad", text: `الرخص: ${n2.length} متوقفة على تعديل ملاحظات المعدة منذ أكثر من ${U.days(Math.min(...n2.map((r) => r.over)))}`, app: "licenses", tab: "list" });
      const n3 = open.filter((r) => r.cls === "N3");
      if (n3.length) out.alerts.push({ level: "warn", text: `الرخص: ${n3.length} تنتظر سداد مبالغ صغيرة للإخلاء — تُغلق بقرار سداد واحد`, app: "licenses", tab: "list" });
      const n5 = open.filter((r) => r.cls === "N5");
      if (n5.length) out.alerts.push({ level: "warn", text: `الرخص: ${n5.length} انتهى عملها الميداني وباقي رفع المراحل والشهادة`, app: "licenses", tab: "list" });
      const age = U.daysFrom(S.licenses.asof);
      if (age > 14) out.gaps.push({ level: "warn", text: `الرخص: آخر تحديث لملف الرخص ${U.dmy(S.licenses.asof)} (منذ ${U.days(age)}). ارفع ملف الأسبوع ليصح حساب التجاوز.`, app: "licenses", tab: "data" });
      return out;
    }

    if (p.id === "dispatch") {
      const d = S.dispatch, days = (d && d.edc) || [], plans = (d && d.plans) || [];
      if (!d || (!days.length && !plans.length)) {
        out.issue = d ? "لا توجد جداول ضمن هذه الفترة." : "لم تصل مزامنة من لوحة التوزيع بعد. تصل تلقائياً عند فتح اللوحة من جهاز المخطط.";
        if (!d) out.gaps.push({ level: "none", text: "التخطيط اليومي: لم تصل مزامنة من لوحة التوزيع بعد — افتح اللوحة مرة من الجهاز الذي تُعدّ عليه الجداول", app: "dispatch", tab: "analysis" });
        return out;
      }
      const all = days.flatMap((x) => x.rows);
      const BAD = new Set(["stopped", "late"]), WAIT = /^wait_/;
      const ok = all.filter((r) => !BAD.has(r.statusCode) && !WAIT.test(r.statusCode) && r.statusCode !== "cancelled" && r.statusCode !== "postponed").length;
      out.score = all.length ? Math.round((ok / all.length) * 100) : null;
      out.level = out.score == null ? "none" : out.score >= 80 ? "ok" : out.score >= 55 ? "warn" : "bad";
      const last = days[0];
      if (last) {
        const done = last.rows.filter((r) => r.statusCode === "done").length, stuck = last.rows.filter((r) => BAD.has(r.statusCode) || WAIT.test(r.statusCode)).length;
        out.fig = String(last.rows.length); out.figLabel = "عمل في جدول " + U.dmy(last.date);
        out.issue = `${done} مكتمل، ${stuck} متوقف أو متأخر أو بانتظار` + (plans[0] ? ` · توزيع ${U.dmy(plans[0].date)}: ${plans[0].sites.length} موقع، ${plans[0].sites.reduce((t, s) => t + s.team.length, 0)} عامل، ${plans[0].sites.reduce((t, s) => t + s.vehicles.length, 0)} معدة` : "");
        if (stuck) out.alerts.push({ level: stuck > 3 ? "bad" : "warn", text: `التخطيط اليومي: ${stuck} عمل متوقف أو متأخر أو بانتظار في جدول ${U.dmy(last.date)}`, app: "dispatch", tab: "analysis" });
      } else if (plans[0]) { out.fig = String(plans[0].sites.length); out.figLabel = "موقع في توزيع " + U.dmy(plans[0].date); out.issue = "لا يوجد جدول أعمال يومية مُزامن."; }
      const age = d.syncedAt ? Math.floor((Date.now() - new Date(d.syncedAt)) / 864e5) : null;
      if (age != null && age > 1) out.gaps.push({ level: "warn", text: `التخطيط اليومي: آخر مزامنة من لوحة التوزيع منذ ${U.days(age)}`, app: "dispatch", tab: "analysis" });
      return out;
    }
    if (p.id === "safety") {
      const rows = cardRows();
      const exp = rows.filter((c) => c.st === "expired");
      const week = rows.filter((c) => c.st === "week");
      const soon = rows.filter((c) => c.st === "soon");
      const total = rows.length;
      out.score = total ? Math.round(((total - exp.length) / total) * 100) : null;
      out.level = !total ? "none" : exp.length > 0 ? (exp.length / total > 0.15 ? "bad" : "warn") : week.length ? "warn" : "ok";
      out.fig = String(exp.length);
      out.figLabel = "بطاقة منتهية من " + total;
      out.issue = exp.length ? `${exp.length} عامل ببطاقة منتهية لا يُسمح له بدخول المواقع` + (week.length ? `، و${week.length} تنتهي خلال أسبوع` : "") : week.length ? `${week.length} بطاقة تنتهي خلال أسبوع` : "كل البطاقات سارية";
      if (exp.length) out.alerts.push({ level: "bad", text: `السلامة: ${exp.length} بطاقة منتهية. أقدمها ${exp[0].name} منذ ${U.days(exp[0].left)}`, app: "safety", tab: "expired" });
      if (week.length) out.alerts.push({ level: "warn", text: `السلامة: ${week.length} بطاقة تنتهي خلال 7 أيام: ${week.map((c) => c.name).join("، ")}`, app: "safety", tab: "soon" });
      if (soon.length) out.alerts.push({ level: "none", text: `السلامة: ${soon.length} بطاقة تنتهي خلال 30 يوماً — جهّز تجديدها`, app: "safety", tab: "soon" });
      const vac = rows.filter((c) => /vacation/i.test(c.remark || "") && c.st === "expired");
      if (vac.length) out.gaps.push({ level: "none", text: `السلامة: ${vac.length} من المنتهية بطاقاتهم في الدمام بسبب الإجازة — تأكد من التجديد قبل العودة`, app: "safety", tab: "expired" });
      return out;
    }
    return out;
  }

  // تقييم الفرع خلال فترة: كل منصة تُقصر على سجلاتها التي يقع تاريخها الرئيسي ضمن الفترة
  // (الرخص: تاريخ الانتهاء، البطاقات: تاريخ الانتهاء، المنصات الخمس: تاريخ كل منصة). period = { from, to } أو null للكل.
  function withPeriod(period, fn) {
    if (!period || (!period.from && !period.to)) return fn();
    S.period = period;
    const inR = (d) => !!d && (!period.from || d >= period.from) && (!period.to || d <= period.to);
    const keep = { l: S.licenses, c: S.cards, d: S.ds, x: S.dispatch };
    if (keep.x) S.dispatch = { ...keep.x, edc: (keep.x.edc || []).filter((d) => inR(d.date)), plans: (keep.x.plans || []).filter((d) => inR(d.date)) };
    S.licenses = { ...keep.l, rows: (keep.l.rows || []).filter((r) => inR(r.end)) };
    S.cards = { ...keep.c, rows: (keep.c.rows || []).filter((r) => inR(r.exp)) };
    S.ds = {};
    Object.keys(keep.d).forEach((id) => { const sc = window.DS && DS.SCHEMAS[id]; S.ds[id] = { ...keep.d[id], rows: keep.d[id].rows.filter((r) => sc && inR(r[sc.dateKey])) }; });
    try { return fn(); } finally { S.licenses = keep.l; S.cards = keep.c; S.ds = keep.d; S.dispatch = keep.x; S.period = null; }
  }
  function evaluateAll(period) {
    return withPeriod(period, evaluateNow);
  }
  function evaluateNow() {
    const items = REGISTRY.map(evaluate);
    const scored = items.filter((i) => i.score != null);
    const overall = scored.length ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length) : null;
    const rank = { bad: 0, warn: 1, none: 2, ok: 3 };
    const alerts = items.flatMap((i) => i.alerts).sort((a, b) => rank[a.level] - rank[b.level]);
    const gaps = items.flatMap((i) => i.gaps).sort((a, b) => rank[a.level] - rank[b.level]);
    return { items, overall, alerts, gaps, covered: scored.length, total: items.length };
  }

  /* ---------- سياق المساعد: كل ما يعرفه عن الفرع في نص مضغوط ---------- */
  function buildContext() {
    const E = evaluateAll();
    const L = [];
    L.push(`# منصة الوبران فرع نجران — ${U.iso(U.today())}`);
    L.push(`مؤشر سلامة الفرع العام: ${E.overall ?? "غير محسوب"}% (محسوب من ${E.covered} من ${E.total} منصات لها بيانات)`);
    E.items.forEach((i) => L.push(`- ${i.name}: الحالة ${i.level}، ${i.fig} ${i.figLabel}. ${i.issue}`));
    L.push("\n## التنبيهات"); E.alerts.forEach((a) => L.push(`- [${a.level}] ${a.text}`));
    L.push("\n## نواقص البيانات"); E.gaps.forEach((g) => L.push(`- ${g.text}`));
    REGISTRY.filter((p) => p.kind === "linked" && S.ds[p.id] && window.DS).forEach((p) => L.push(DS.context(p, S.ds[p.id])));
    REGISTRY.filter((p) => p.kind === "linked" && !S.ds[p.id]).forEach((p) => {
      const arr = (S.snapshots[p.id] || []).slice(-5);
      if (!arr.length) return;
      L.push(`\n## ${p.name} — آخر القراءات`);
      arr.forEach((s) => L.push(`- ${s.date}: ` + p.fields.map((f) => `${f.label}=${s.values[f.key] ?? "؟"}${f.unit ? " " + f.unit : ""}`).join("، ") + (s.note ? ` (ملاحظة: ${s.note})` : "")));
    });
    if (S.dispatch && (S.dispatch.edc || []).length) {
      const x = S.dispatch.edc[0];
      L.push(`\n## جدول الأعمال اليومية (الكهرباء) — ${x.date}، ${x.rows.length} عمل — رقم|أمر العمل|نوع العمل|التصنيف|المستلم|الموقع|الجهد|الحالة|الإنجاز`);
      x.rows.forEach((r) => L.push(`${r.seq}|${r.woNumber}|${r.workType}|${r.category}|${r.receiver}|${r.location}|${r.voltage}|${r.status}|${r.progress ?? ""}`));
      const pl = (S.dispatch.plans || [])[0];
      if (pl) { L.push(`\n## توزيع العمالة والمعدات — ${pl.date}`); pl.sites.forEach((s) => L.push(`- ${s.name}${s.workType ? " (" + s.workType + ")" : ""}: معدات ${s.vehicles.map((v) => "NP#" + v.fleetNo + (v.driver ? "/" + v.driver : "")).join("، ") || "—"} · فريق ${s.team.map((t) => t.name + (t.role === "foreman" ? " (فورمان)" : "")).join("، ") || "—"}`)); }
    }
    L.push(`\n## الرخص (ملف بتاريخ ${S.licenses.asof}) — رقم|أمر العمل|الموقع|المهندس|الانتهاء|التصنيف|أيام التجاوز|السبب`);
    licRows().forEach((r) => L.push(`${r.id}|${r.wo}|${r.loc}|${r.eng}|${r.end}|${r.clsName}|${r.closed ? "مغلقة" : r.over}|${(r.why || "").slice(0, 160)}`));
    L.push(`\n## بطاقات السلامة — رقم|الاسم|الانتهاء|الأيام المتبقية|الحالة|ملاحظة`);
    cardRows().forEach((c) => L.push(`${c.emp}|${c.name}|${c.exp}|${c.left}|${CARD_ST[c.st]}|${c.remark || ""}`));
    return L.join("\n");
  }

  // يرفع السياق للقاعدة ليستخدمه الملخص اليومي التلقائي (مرة كل 6 ساعات على الأكثر من كل جهاز).
  async function pushContext() {
    const last = U.ls.get("ctxAt");
    if (last && Date.now() - last < 6 * 36e5) return;
    const text = buildContext();
    try {
      const r = await fetch("/api/data?key=context", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, at: new Date().toISOString() }) });
      if (r.ok) U.ls.set("ctxAt", Date.now());
    } catch (e) {}
  }

  window.HUB = { withPeriod, U, Store, S, loadAll, classify, licRows, cardRows, CARD_ST, LIC_CLS, latest, evaluate, evaluateAll, buildContext, pushContext };
})();
