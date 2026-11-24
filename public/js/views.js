/* الصفحات: الرئيسية، المنصات المرتبطة، الرخص، بطاقات السلامة، الإعدادات — مع موجّه بسيط بالـ hash. */
(function () {
  "use strict";
  const { U, Store, S } = HUB;
  const { $, esc } = U;
  const view = $("#view");
  const LV = { ok: "سليم", warn: "يحتاج متابعة", bad: "يحتاج قراراً", none: "بلا بيانات" };
  const LVC = { ok: "var(--ok)", warn: "var(--volt)", bad: "var(--bad)", none: "var(--none)" };
  const reg = (id) => REGISTRY.find((p) => p.id === id);
  const link = (app, tab) => `#/app/${app}${tab ? "/" + tab : ""}`;
  let E = null;
  const ui = { df: { dims: {}, state: "", from: "", to: "" }, lf: { eng: "", state: "", from: "", to: "" }, licPer: 0, licF: "", licQ: "", cardQ: "", pendLic: null, pendCards: null, dsF: "", dsQ: "", pendDs: null };

  /* ---------- القائمة الجانبية ---------- */
  function renderNav(route) {
    const items = E ? E.items : [];
    const lv = (id) => (items.find((i) => i.id === id) || {}).level || "none";
    const a = (href, label, icon, cur, dot) =>
      `<a href="${href}" ${cur ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg><span>${esc(label)}</span>${dot ? `<i class="dot ${dot}" title="${LV[dot]}"></i>` : "<i></i>"}</a>`;
    $("#nav").innerHTML =
      a("#/", "الصفحة الرئيسية", "M3 11l9-7 9 7v9H3zM9 20v-6h6v6", route.name === "home") +
      `<h4>التطبيقات</h4>` +
      REGISTRY.map((p) => a(link(p.id), p.name, p.icon, route.app === p.id, lv(p.id))).join("");
  }

  /* ---------- الصفحة الرئيسية ---------- */
  function phrase(i) {
    if (i.level === "none" || i.level === "ok") return null;
    if (i.id === "licenses") { const n = HUB.licRows().filter((r) => !r.closed && r.over > 0).length; return `<b>${n}</b> رخصة مفتوحة تجاوزت مدتها`; }
    if (i.id === "safety") { const n = HUB.cardRows().filter((c) => c.st === "expired").length; return n ? `<b>${n}</b> عاملاً ببطاقة سلامة منتهية` : `بطاقات سلامة تنتهي خلال أسبوع`; }
    return `${esc(i.short)}: ${esc(i.issue)}`;
  }
  /* فترة تحليل الصفحة الرئيسية: آخر شهر / آخر 3 أشهر / الكل / فترة مخصصة */
  const HP_KEY = "homePer";
  function homePeriod() {
    const hp = U.ls.get(HP_KEY) || { per: "all", from: "", to: "" };
    const t = U.today();
    if (hp.per === 1 || hp.per === 3) { const d = new Date(t.getFullYear(), t.getMonth() - hp.per, t.getDate()); return { hp, period: { from: U.iso(d), to: "" }, label: hp.per === 1 ? "آخر شهر" : "آخر 3 أشهر", from: U.iso(d) }; }
    if (hp.per === "custom" && (hp.from || hp.to)) return { hp, period: { from: hp.from, to: hp.to }, label: "فترة مخصصة", from: hp.from };
    return { hp, period: null, label: "كل الفترات" };
  }
  function home() {
    const P = homePeriod();
    HUB.withPeriod(P.period, () => homeInner(HUB.evaluateAll(), P));
  }
  function homeInner(E, P) {
    const rank = { bad: 0, warn: 1 };
    const hot = E.items.filter((i) => i.level === "bad" || i.level === "warn").sort((a, b) => rank[a.level] - rank[b.level]);
    const empty = E.items.filter((i) => i.level === "none");
    const parts = hot.map(phrase).filter(Boolean).slice(0, 3);
    let line;
    if (parts.length) line = (parts.length > 1 ? parts.slice(0, -1).join("، ") + "، و" + parts[parts.length - 1] : parts[0]) + ".";
    else line = E.covered ? "كل المنصات التي لها بيانات في وضع سليم اليوم." : "لا توجد بيانات كافية بعد لتقييم الفرع.";
    const sub = `مؤشر سلامة الفرع <b class="num">${E.overall ?? "—"}%</b>، محسوب من ${E.covered} من ${E.total} منصات. ` +
      (empty.length ? `${empty.length} منصات لا تظهر في التقييم لأنها بلا قراءة: ${empty.map((i) => esc(i.short)).join("، ")}.` : "كل المنصات داخلة في التقييم.");

    const tiers = E.items.map((i) => `<button class="tier ${i.score == null ? "none" : ""}" style="--c:${LVC[i.level]}" data-go="${link(i.id)}" type="button" aria-label="${esc(i.name)}: ${i.score == null ? "بلا بيانات" : i.score + "%"}">
        <span class="lb">${esc(i.short)}</span><span class="tr"><span class="fl" style="width:${i.score ?? 0}%"></span></span><span class="vl num">${i.score == null ? "—" : i.score + "%"}</span></button>`).join("");

    const rows = E.items.map((i) => `<a class="row" href="${link(i.id)}">
        <i class="dot ${i.level}" title="${LV[i.level]}"></i>
        <span class="nm"><b>${esc(i.name)}</b><span>${LV[i.level]}</span></span>
        <span class="fig num">${esc(i.fig)}<small>${esc(i.figLabel || "—")}</small></span>
        <span class="issue">${esc(i.issue)}</span><span class="go">افتح</span></a>`).join("");

    const li = (x) => `<li class="lvl-${x.level}"><div>${esc(x.text)} <a href="${link(x.app, x.tab)}">اذهب</a></div></li>`;
    const sm = S.summary;
    const hp = P.hp;
    const perTxt = P.period ? `${P.label}${P.period.from ? " · من " + U.dmy(P.period.from) : ""}${P.period.to ? " حتى " + U.dmy(P.period.to) : ""}` : "كل الفترات";
    view.innerHTML = `
      <section class="perbar panel">
        <div class="perbar-row"><h2>تحليل المنصات</h2>
          <div class="chips" role="group" aria-label="فترة التحليل">${[[1, "آخر شهر"], [3, "آخر 3 أشهر"], ["all", "الكل"], ["custom", "اختيار فترة"]].map(([k, l]) => `<button class="chip" type="button" data-hper="${k}" aria-pressed="${String(hp.per) === String(k)}">${l}</button>`).join("")}</div></div>
        ${hp.per === "custom" ? `<div class="form" style="margin-top:10px;max-width:520px"><label class="f">من<input type="date" id="hpFrom" value="${esc(hp.from || "")}"></label><label class="f">إلى<input type="date" id="hpTo" value="${esc(hp.to || "")}"></label></div>` : ""}
        <p class="hint" style="margin:8px 0 0">فترة التحليل: <b>${esc(perTxt)}</b>. تُحسب كل منصة من سجلاتها التي يقع تاريخها الرئيسي ضمن الفترة: انتهاء الرخصة والبطاقة، تاريخ الفاتورة، تاريخ التسليم، ويوم العمل. اضغط أي صف لفتح المنصة.</p>
      </section>
      <section class="section" style="margin-top:14px"><div class="ledger">${rows}</div></section>
      <div class="hero section">
        <div class="panel"><h3>تحتاج قراراً</h3><p class="hint">مرتبة من الأخطر. كل تنبيه يفتح مكانه.</p>
          ${E.alerts.length ? `<ul class="list">${E.alerts.map(li).join("")}</ul>` : `<div class="empty">لا تنبيهات اليوم.</div>`}</div>
        <div class="tower" aria-label="تحليل أداء الفرع">
          <h2>تحليل أداء الفرع <span class="num">${E.overall ?? "—"}%</span></h2>
          <p>كل طبقة منصة؛ طولها نسبة سلامتها ولونها حالتها. الطبقة المخططة بلا بيانات.</p>
          <div class="tiers">${tiers}</div><div class="base"></div>
        </div>
      </div>
      <section class="section">
        <div class="panel" id="gaps"><h3>نواقص البيانات</h3><p class="hint">ما ينقص ليكون التقرير كاملاً وصحيحاً.</p>
          ${E.gaps.length ? `<ul class="list">${E.gaps.map(li).join("")}</ul>` : `<div class="empty">البيانات مكتملة.</div>`}</div>
      </section>
      <section class="section panel"><h3>ملخص الإدارة العليا اليومي</h3>
        <p class="hint">يكتبه المساعد الذكي تلقائياً كل صباح 8:10 بتوقيت الرياض من بيانات كل المنصات.</p>
        ${sm && sm.text ? `<p class="summary-text">${esc(sm.text)}</p><p class="meta">كُتب ${esc(new Date(sm.at).toLocaleString("ar-SA-u-nu-latn"))}</p>` : `<div class="empty"><h3>لم يُكتب ملخص اليوم بعد</h3><p>اطلبه الآن من المساعد، أو انتظر الملخص التلقائي صباح الغد.</p></div>`}
        <div class="acts" style="margin-top:12px"><button class="btn" type="button" id="genSummary">اكتب الملخص الآن واحفظه</button></div>
        <p class="msg" id="sumMsg" role="status"></p>
      </section>
      <section class="section panel brief-bottom">
        <div class="brief">
          <p class="when">موقف الفرع · ${U.longDate()} · ${esc(perTxt)}</p>
          <p class="line">${line}</p>
          <p class="sub">${sub}</p>
          <div class="acts"><button class="btn pri" type="button" data-ask="اكتب ملخص اليوم للإدارة العليا">ملخص اليوم من المساعد</button><a class="btn" href="#gaps">نواقص البيانات (${E.gaps.length})</a></div>
        </div>
      </section>`;
  }

  /* ---------- رأس التطبيق والتبويبات ---------- */
  function appShell(p, tabs, tab, body) {
    return `<div class="app-head"><div><h1>${esc(p.name)}</h1><p>${esc(p.purpose)}</p></div>
      ${p.url ? `<a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">افتح المنصة في نافذة جديدة</a>` : ""}</div>
      <div class="tabs" role="tablist">${tabs.map((t) => `<button role="tab" type="button" data-go="${link(p.id, t[0])}" aria-selected="${t[0] === tab}">${t[1]}${t[2] != null ? ` <span class="count num">${t[2]}</span>` : ""}</button>`).join("")}</div>
      <div role="tabpanel">${body}</div>`;
  }
  function frame(url, label) {
    return `<div class="frame-wrap"><div class="frame-bar"><span>${esc(label)} معروضة من مصدرها كما هي. إن ظهرت فارغة فالمنصة تمنع العرض داخل صفحات أخرى.</span><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">فتح مستقل</a></div>
      <iframe src="${esc(url)}" title="${esc(label)}" loading="lazy" referrerpolicy="no-referrer"></iframe></div>`;
  }
  function kpis(list) { return `<div class="kpis">${list.map((k) => `<div class="kpi ${k[2] || ""}"><b>${k[1]}</b><span>${esc(k[0])}</span></div>`).join("")}</div>`; }

  /* ---------- المنصات الخمس: لوحة تحليلية داخلية + عرض المنصة الأصلية ---------- */
  const KCOL = { done: "var(--ok)", active: "var(--mud)", pending: "var(--none)", problem: "var(--bad)", cancel: "var(--line)" };
  const KP = { done: "p-ok", active: "p-warn", pending: "p-none", problem: "p-bad", cancel: "p-none" };
  function spark(vals) {
    const v = vals.map(Number).filter((x) => !isNaN(x));
    if (v.length < 2) return "";
    const mx = Math.max(...v), mn = Math.min(...v), W = 200, H = 40;
    const pts = v.map((x, i) => `${(W - (i / (v.length - 1)) * W).toFixed(1)},${(H - 4 - ((x - mn) / (mx - mn || 1)) * (H - 8)).toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--mud)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const money = (n) => (n == null ? "—" : U.fmt(Math.round(n)));
  const big = (n) => (n == null ? "—" : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + "<small> مليون ريال</small>" : U.fmt(Math.round(n)) + "<small> ريال</small>");
  function barList(items, max, fmt) {
    return `<div class="bars">${items.map((x) => `<div class="bar" style="--c:${x.c || "var(--ink)"}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.l)}</span><span class="tr"><span class="fl" style="width:${max ? (x.v / max) * 100 : 0}%"></span></span><span class="v num">${fmt ? fmt(x.v) : x.v}</span></div>`).join("")}</div>`;
  }
  function recTable(A, list, keys) {
    const s = A.s;
    keys = keys || Object.keys(s.cols).filter((k) => list.some((r) => r[k] != null && r[k] !== ""));
    const cell = (r, k) => { const t = s.cols[k].type, v = r[k]; return t === "date" ? U.dmy(v) : t === "num" ? money(v) : esc(v ?? ""); };
    return `<div class="tbl"><table><thead><tr>${keys.map((k) => `<th>${esc(s.cols[k].label)}</th>`).join("")}<th>التصنيف</th><th>${s.dueKey ? "التأخر (يوم)" : "العمر (يوم)"}</th></tr></thead><tbody>
      ${list.slice(0, 500).map((r) => r._n ? `<tr><td colspan="${keys.length + 2}" style="color:var(--muted)">مجموعة منتهية: ${r._n} ${esc(s.unit)} — ${esc(s.title(r))} ${r.year || ""} — ${money(r[s.amountKey])} ريال</td></tr>` : `<tr>${keys.map((k) => `<td${s.cols[k].type ? ' class="num"' : ""}>${cell(r, k)}</td>`).join("")}<td><span class="pill ${KP[r.kind]}">${esc(s.classes[r.cls].label)}</span></td><td class="num">${r.lateBy ? `<span class="pill p-bad">${s.dueKey ? r.lateBy : r.age}</span>` : r.age != null && !r._n ? r.age : "—"}</td></tr>`).join("") || `<tr><td colspan="${keys.length + 2}" class="empty">لا سجلات مطابقة.</td></tr>`}</tbody></table></div>${list.length > 500 ? `<p class="meta">يُعرض أول 500 من ${list.length}. استخدم البحث للتضييق.</p>` : ""}`;
  }
  /* ---------- تصدير أي تقرير مفلتر: Excel / CSV / طباعة ---------- */
  const SIGNTXT = "Project Manager | Eng. Ahmed Zahran";
  function exportReport(kind, o) {
    const today = U.dmy(U.iso(U.today())), base = o.file + "-" + U.iso(U.today());
    const dlb = (name, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
    if (kind === "xlsx") {
      if (typeof XLSX === "undefined") { alert("مكتبة Excel لم تُحمّل بعد. تحقق من الاتصال."); return; }
      const aoa = [[o.title + " — الوبران نجران"], ["التقرير: " + o.desc], ["تاريخ التقرير: " + today + " · عدد السجلات: " + o.count], [], o.head].concat(o.rows).concat([[], [SIGNTXT]]);
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = o.head.map((h, i) => ({ wch: Math.min(60, Math.max(10, ...[h].concat(o.rows.slice(0, 200).map((r) => r[i])).map((v) => String(v ?? "").length + 2))) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "التقرير"); wb.Workbook = { Views: [{ RTL: true }] };
      dlb(base + ".xlsx", new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }));
    } else if (kind === "csv") {
      const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      dlb(base + ".csv", new Blob(["\ufeff" + [["التقرير: " + o.desc], o.head].concat(o.rows).concat([[], [SIGNTXT]]).map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    } else {
      const w = window.open("", "_blank"); if (!w) { alert("اسمح بالنوافذ المنبثقة للطباعة."); return; }
      w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(o.title)}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:22px;color:#13262F}h1{font-size:19px;margin:0}p{margin:4px 0 12px;color:#555}table{border-collapse:collapse;width:100%;font-size:11.5px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:right;vertical-align:top}th{background:#13262F;color:#fff}.sign{margin-top:22px;direction:ltr;text-align:center;font-weight:bold}</style></head><body><h1>${esc(o.title)} — الوبران نجران</h1><p>${esc(o.desc)} · ${o.count} سجل · ${today}</p><table><thead><tr>${o.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${o.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table><div class="sign">${SIGNTXT}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
    }
  }
  const expBar = (desc, n, attr) => `<div class="exp-bar"><span class="hint" style="margin:0">${esc(desc)} — <b>${U.fmt(n)}</b> سجل</span><span class="exp-btns"><button class="btn pri sm" type="button" ${attr}="xlsx">تصدير Excel</button><button class="btn sm" type="button" ${attr}="csv">تصدير CSV</button><button class="btn sm" type="button" ${attr}="print">طباعة / PDF</button></span></div>`;

  /* ---------- فلاتر المنصات الخمس ---------- */
  function dsFiltered(A) {
    const f = ui.df, q = ui.dsQ.trim().toLowerCase(), dk = A.s.dateKey;
    return A.rows.filter((r) => (!ui.dsF || r.cls === ui.dsF)
      && Object.entries(f.dims).every(([k, v]) => !v || (r[k] || "غير محدد") === v)
      && (!f.state || (f.state === "late" ? r.lateBy > 0 : f.state === "open" ? r.kind !== "done" && r.kind !== "cancel" : f.state === "done" ? r.kind === "done" : f.state === "ontime" ? r.kind !== "done" && !(r.lateBy > 0) : true))
      && (!f.from || (r[dk] && r[dk] >= f.from)) && (!f.to || (r[dk] && r[dk] <= f.to))
      && (!q || Object.values(r).join(" ").toLowerCase().includes(q)));
  }
  function dsDesc(A) {
    const f = ui.df, s = A.s, p = [];
    if (ui.dsF) p.push(s.classes[ui.dsF].label);
    Object.entries(f.dims).forEach(([k, v]) => { if (v) p.push((s.dims.find((d) => d[0] === k) || [0, k])[1] + ": " + v); });
    if (f.state) p.push({ late: "المتأخرة فقط", open: "المفتوحة فقط", done: "المنجزة فقط", ontime: "المفتوحة ضمن المدة" }[f.state]);
    if (f.from) p.push(s.cols[s.dateKey].label + " من " + U.dmy(f.from)); if (f.to) p.push("حتى " + U.dmy(f.to));
    if (ui.dsQ.trim()) p.push("بحث: " + ui.dsQ.trim());
    return p.length ? p.join(" · ") : "كل السجلات";
  }
  function dsExport(kind, p, A, list, desc) {
    const s = A.s, keys = Object.keys(s.cols).filter((k) => list.some((r) => r[k] != null && r[k] !== ""));
    const val = (r, k) => { const t = s.cols[k].type, v = r[k]; return t === "date" ? (v ? U.dmy(v) : "") : t === "num" ? (v == null ? "" : Math.round(v * 100) / 100) : v ?? ""; };
    const head = keys.map((k) => s.cols[k].label).concat(["التصنيف", s.dueKey ? "التأخر (يوم)" : "العمر (يوم)", "عدد الأوامر"]);
    const rows = list.map((r) => keys.map((k) => val(r, k)).concat([s.classes[r.cls].label, r._n ? "" : (s.dueKey ? r.lateBy || "" : r.age ?? ""), r._n || 1]));
    exportReport(kind, { title: p.name, desc, head, rows, count: A.W(list), file: p.id });
  }

  function linkedApp(p, tab) {
    const ds = S.ds[p.id];
    const A = ds ? DS.analyze(p.id, ds) : null;
    const ev = E.items.find((i) => i.id === p.id);
    tab = tab || (A ? "overview" : "data");
    const tabs = [["overview", "الصورة العامة"], ["analysis", "التحليل"]].concat(p.id === "schedule" ? [] : [["late", "المتأخرة", A ? A.W(A.late) : null]]).concat([ ["all", "التقارير والتصدير", A ? A.W(A.rows) : null], ["data", "تحديث البيانات"], ["board", "المنصة الأصلية"]]);
    let body = "";
    const needData = `<div class="panel empty"><h3>لم تُرفع بيانات ${esc(p.short)} بعد</h3><p>ارفع ملف Excel أو الصق الجدول من المنصة الأصلية لتظهر هنا اللوحة التحليلية، وتدخل المنصة في تقرير الفرع والمساعد.</p><button class="btn pri" data-go="${link(p.id, "data")}" type="button">تحديث البيانات</button></div>`;
    const stale = A && U.daysFrom(ds.asof) > 3 ? `<div class="note">آخر بيانات بتاريخ ${U.dmy(ds.asof)} (منذ ${U.days(U.daysFrom(ds.asof))}). ${DS.AUTO[p.id] ? "البوابة تسحب من المنصة الأصلية تلقائياً، والمنصة نفسها لم تُحدّث منذ ذلك التاريخ." : "ارفع آخر نسخة من «تحديث البيانات»."}</div>` : "";

    if (tab === "board") body = frame(p.url, p.name);
    else if (tab === "data") body = dataTab(p, A, ds);
    else if (!A) body = needData;
    else if (tab === "overview") {
      const s = A.s, open = A.live.length - A.done.length;
      let k;
      const lateAmt = A.sum(A.late), openAmt = A.sum(A.open);
      if (p.id === "invoices") k = [["عدد الفواتير", U.fmt(A.W(A.live))], ["إجمالي الصافي", big(A.total)], ["المحصّل", big(A.doneAmt), "ok"], ["غير المحصّل", big(A.total - A.doneAmt), "warn"], ["نسبة التحصيل", (A.score ?? "—") + "%", ev.level], ["غير محصّلة أقدم من " + s.sla + " يوماً", A.W(A.late), "bad"]];
      else if (p.id === "schedule") { const m = A.months[A.months.length - 1], pm = A.months[A.months.length - 2], yr = A.months.filter((x) => x.key.startsWith(String(U.today().getFullYear()))).reduce((t, x) => t + x.amt, 0), dd = new Set(A.live.map((r) => r.date)).size; k = [["منفذ هذا الشهر", big(m.amt), "ok"], ["الشهر السابق", big(pm.amt)], ["منذ بداية السنة", big(yr)], ["أيام عمل آخر 30 يوماً", A.days30, ev.level], ["متوسط اليوم", big(A.total / Math.max(1, dd))], ["آخر تقرير", U.dmy(ds.asof)]]; }
      else if (p.id === "dispatch") k = [["إجمالي المهام", A.W(A.live)], ["اليوم", A.todays.length], ["منجز اليوم", A.todays.filter((r) => r.kind === "done").length, "ok"], ["نسبة الإنجاز حتى اليوم", (A.score ?? "—") + "%", ev.level], ["لم تنفذ في موعدها", A.W(A.late), "bad"]];
      else k = [["إجمالي الأوامر", U.fmt(A.W(A.live))], ["مفتوحة", U.fmt(A.W(A.open)), "warn"], ["قيمة المفتوحة", big(openAmt)], [s.slaText ? "متأخرة (" + s.sla + "+ يوم)" : "متأخرة", U.fmt(A.W(A.late)), "bad"], ["قيمة المتأخرة", big(lateAmt), "bad"], ["ضمن المدة", (A.score ?? "—") + "%", ev.level]];
      const mxC = Math.max(1, ...A.byCls.map((c) => c.n));
      const useAmt = p.id === "invoices" || p.id === "schedule";
      const mxM = Math.max(1, ...A.months.map((m) => (useAmt ? m.amt : m.n)));
      const d0 = A.dims[0];
      body = stale + kpis(k) + `<p class="meta">${esc(ev.issue)}</p>
        <div class="section two">
          ${p.id === "schedule" ? (() => { const byDay = new Map(); A.live.forEach((r) => byDay.set(r.date, (byDay.get(r.date) || 0) + (r.value || 0))); const ds14 = [...byDay].sort((x, y) => (x[0] < y[0] ? 1 : -1)).slice(0, 14); return `<div class="panel"><h3>آخر 14 يوم عمل (ريال)</h3><p class="hint">قيمة المنفذ في كل يوم مسجل.</p>${barList(ds14.map(([d, v]) => ({ l: U.dmy(d), v: Math.round(v), c: "var(--ok)" })), Math.max(1, ...ds14.map((x) => x[1])), money)}</div>`; })() : `<div class="panel"><h3>حسب الحالة</h3><p class="hint">${p.id === "invoices" ? "عدد الفواتير في كل تصنيف." : "أين تقف السجلات الآن."}</p>${barList(A.byCls.map((c) => ({ l: c.label, v: c.n, c: KCOL[c.kind] })), mxC)}</div>`}
          <div class="panel"><h3>${useAmt ? (p.id === "schedule" ? "قيمة المنفذ شهرياً (ريال)" : "قيمة الفواتير شهرياً (ريال)") : "الحركة الشهرية"}</h3><p class="hint">آخر 12 شهراً حسب ${esc(s.cols[s.dateKey].label)}.</p>${barList(A.months.slice().reverse().map((m) => ({ l: m.label + " " + m.key.slice(0, 4), v: useAmt ? Math.round(m.amt) : m.n, c: m.done && !useAmt && m.done === m.n ? "var(--ok)" : "var(--ink)" })), mxM, useAmt ? money : null)}</div>
        </div>
        <div class="section two">
          ${d0 ? `<div class="panel"><h3>حسب ${esc(d0.label)}${useAmt ? " (ريال)" : ""}</h3><p class="hint">${p.id === "invoices" ? "للفواتير غير المحصّلة فقط." : useAmt ? "الأعلى قيمة أولاً." : "الأكثر تأخراً أولاً."} التفاصيل في «التحليل».</p>${useAmt ? barList(d0.groups.slice(0, 10).map((g) => ({ l: g.name, v: Math.round(g.amt || 0), c: g.late ? "var(--bad)" : "var(--ink)" })), Math.max(1, ...d0.groups.map((g) => g.amt || 0)), money) : barList(d0.groups.slice(0, 10).map((g) => ({ l: g.name, v: g.total, c: g.late ? "var(--bad)" : "var(--ink)" })), Math.max(1, ...d0.groups.map((g) => g.total)))}</div>` : ""}
          <div class="panel"><h3>${p.id === "schedule" ? "آخر أيام العمل" : "أكثر ما يحتاج متابعة"}</h3><p class="hint">${p.id === "schedule" ? "قيمة المنفذ لكل موقع." : "أقدم المتأخرات."}</p>${p.id === "schedule" ? `<ul class="list">${A.rows.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8).map((r) => `<li class="lvl-ok"><div><b>${U.dmy(r.date)}</b> ${esc(r.site)}<small>${r.items} بند · ${money(r.value)} ريال</small></div></li>`).join("")}</ul>` : A.late.length ? `<ul class="list">${A.late.slice(0, 8).map((r) => `<li class="lvl-bad"><div><b>${esc(r.wo || r.no || "")}</b> ${esc(s.title(r))}${r[s.amountKey] ? " · " + money(r[s.amountKey]) + " ريال" : ""}<small>${esc(s.classes[r.cls].label)} · ${s.dueKey ? "متأخر " + U.days(r.lateBy) : "منذ " + U.days(r.age)}${r.eng ? " · " + esc(r.eng) : r.crew ? " · " + esc(r.crew) : r.to ? " · " + esc(r.to) : ""}</small></div></li>`).join("")}</ul>` : `<div class="empty">لا متأخرات.</div>`}</div>
        </div>` + (p.id === "projects" || p.id === "assign" || p.id === "invoices" ? (() => {
          const B = [["أقل من 90 يوماً", 0, 90], ["3 – 12 شهراً", 90, 365], ["1 – 2 سنة", 365, 730], ["2 – 3 سنوات", 730, 1095], ["أكثر من 3 سنوات", 1095, 1e9]];
          const op = A.open.filter((r) => r.age != null), noDate = A.W(A.open) - A.W(op);
          const g = B.map(([l, a, b]) => { const x = op.filter((r) => r.age >= a && r.age < b); return { l, n: A.W(x), amt: A.sum(x) }; });
          const mx = Math.max(1, ...g.map((x) => x.n));
          return `<section class="section panel"><h3>عمر ${p.id === "invoices" ? "الفواتير غير المحصّلة" : "الأوامر المفتوحة"}</h3><p class="hint">محسوب من ${esc(s.cols[s.dateKey].label)}${noDate ? ` · ${noDate} بلا تاريخ` : ""}.</p>${barList(g.map((x, i) => ({ l: x.l + (x.amt != null ? " · " + money(x.amt) + " ريال" : ""), v: x.n, c: i === 0 ? "var(--ok)" : i === 1 ? "var(--volt)" : "var(--bad)" })), mx)}</section>`;
        })() : "");
    } else if (tab === "analysis") {
      body = stale + A.dims.map((d) => `<section class="section"><h2>حسب ${esc(d.label)}</h2><div class="tbl"><table><thead><tr><th>${esc(d.label)}</th><th>الإجمالي</th><th>منجز</th><th>مفتوح</th><th>متأخر</th><th>نسبة الإنجاز</th>${A.s.amountKey ? "<th>القيمة (ريال)</th>" : ""}</tr></thead><tbody>
        ${d.groups.map((g) => `<tr><td>${esc(g.name)}</td><td class="num">${g.total}</td><td class="num">${g.done}</td><td class="num">${g.total - g.done}</td><td class="num">${g.late ? `<span class="pill p-bad">${g.late}</span>` : 0}</td><td class="num">${Math.round((g.done / g.total) * 100)}%</td>${A.s.amountKey ? `<td class="num">${money(g.amt)}</td>` : ""}</tr>`).join("")}</tbody></table></div></section>`).join("") || `<div class="empty">لا توجد أعمدة تحليل في الملف (${A.s.dims.map((d) => d[1]).join("، ")}).</div>`;
    } else if (tab === "late") body = stale + (A.late.length ? `<div class="panel">${expBar("المتأخرة: " + (A.s.slaText || "تجاوزت موعدها"), A.W(A.late), "data-dlexp")}</div>` + recTable(A, A.late) : `<div class="panel empty"><h3>لا متأخرات</h3><p>كل السجلات المفتوحة ضمن موعدها.</p></div>`);
    else {
      const list = dsFiltered(A), s = A.s, f = ui.df;
      const opt = (v, cur, l) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
      body = `<div class="panel">
        <div class="chips"><button class="chip" data-dsf="" aria-pressed="${!ui.dsF}" type="button">الكل ${U.fmt(A.W(A.rows))}</button>${A.byCls.map((c) => `<button class="chip" style="--c:${KCOL[c.kind]}" data-dsf="${c.k}" aria-pressed="${ui.dsF === c.k}" type="button"><i></i>${esc(c.label)} ${U.fmt(c.n)}</button>`).join("")}</div>
        <div class="form">
          <label class="f">بحث<input type="search" id="dsQ" value="${esc(ui.dsQ)}" placeholder="أي رقم أو اسم أو موقع"></label>
          ${A.dims.map((d) => `<label class="f">${esc(d.label)}<select data-dfdim="${d.k}">${opt("", f.dims[d.k] || "", "الكل")}${d.groups.slice(0, 200).map((g) => opt(g.name, f.dims[d.k] || "", g.name + " (" + g.total + ")")).join("")}</select></label>`).join("")}
          ${p.id === "schedule" ? "" : `<label class="f">الموقف<select id="dfState">${[["", "الكل"], ["open", "المفتوحة"], ["late", "المتأخرة"], ["ontime", "المفتوحة ضمن المدة"], ["done", "المنجزة"]].map(([v, l]) => opt(v, f.state, l)).join("")}</select></label>`}
          <label class="f">${esc(s.cols[s.dateKey].label)} من<input type="date" id="dfFrom" value="${esc(f.from)}"></label>
          <label class="f">حتى<input type="date" id="dfTo" value="${esc(f.to)}"></label>
          <div><button class="btn sm" type="button" data-dfreset>مسح الفلاتر</button></div>
        </div>${expBar(dsDesc(A), A.W(list), "data-dexp")}</div>` + recTable(A, list);
    }
    view.innerHTML = appShell(p, tabs, tab, body);
    if (tab === "data" && ui.pendDs && ui.pendDs.id === p.id) renderDsPend();
  }
  function dataTab(p, A, ds) {
    const s = DS.SCHEMAS[p.id];
    const auto = DS.AUTO[p.id];
    return `<div class="panel"><h3>مصدر البيانات</h3><p class="hint">${esc(s.origin)}. ${auto ? "تُسحب تلقائياً من المنصة الأصلية كل 6 ساعات." : p.id === "assign" ? "منصة أوامر العمل تتطلب تسجيل الدخول، فحُمّلت بياناتها مرة واحدة من قاعدة بياناتها. لتحديثها ارفع ملفها هنا أو اطلب إعادة السحب." : ""}</p>
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}
        ${ds ? `<p class="meta">آخر بيانات: ${U.dmy(ds.asof)}${ds.syncedAt ? " · آخر مزامنة " + esc(new Date(ds.syncedAt).toLocaleString("ar-SA-u-nu-latn")) : ""} · ${U.fmt(A ? A.W(A.rows) : 0)} ${esc(s.unit)}</p>` : ""}
        ${auto ? `<button class="btn pri" type="button" id="syncNow">مزامنة الآن من المنصات الأصلية</button><p class="msg" id="syncMsg" role="status"></p>` : ""}</div>
      <div class="panel section"><h3>رفع بيانات ${esc(p.short)} يدوياً</h3><p class="hint">ملف Excel أو CSV مُصدّر من المنصة الأصلية، أو أي جدول يحتوي هذه الأعمدة (يكفي بعضها، والعناوين تُكتشف بالعربي أو الإنجليزي): ${Object.values(s.cols).map((c) => esc(c.label)).join("، ")}.</p>
        <div class="drop"><p style="margin:0 0 10px">اختر الملف</p><input type="file" id="dsFile" data-app="${p.id}" accept=".xlsx,.xls,.csv"></div>
        <details class="section"><summary style="cursor:pointer;font-weight:600">أو الصق الجدول منسوخاً من المنصة الأصلية</summary>
          <p class="hint" style="margin-top:8px">افتح «المنصة الأصلية»، حدّد الجدول مع صف العناوين، انسخه (Ctrl+C) والصقه هنا.</p>
          <textarea id="dsPaste" rows="6" style="width:100%" placeholder="الصق هنا"></textarea>
          <div style="margin-top:8px"><button class="btn" type="button" data-dsparse="${p.id}">قراءة الجدول الملصق</button></div></details>
        <div id="dsPend"></div><p class="msg" id="dsMsg" role="status"></p>
        <div class="acts" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-tpl="${p.id}">تنزيل نموذج الأعمدة</button>${A ? `<button class="btn" type="button" data-dscsv="${p.id}">تنزيل البيانات الحالية</button><button class="btn" type="button" data-dsclear="${p.id}">حذف البيانات</button>` : ""}</div></div>
      ${A ? `<div class="panel section"><h3>البيانات الحالية</h3><p class="hint">${A.rows.length} سجل بتاريخ ${U.dmy(ds.asof)}${ds.sheet ? " من الورقة «" + esc(ds.sheet) + "»" : ""}. الأعمدة المقروءة: ${esc((ds.mapped || []).join("، "))}.${ds.missing && ds.missing.length ? " غير موجودة: " + esc(ds.missing.join("، ")) + "." : ""}</p></div>` : ""}`;
  }
  function renderDsPend() {
    const el = $("#dsPend"); if (!el || !ui.pendDs) return; const P = ui.pendDs, s = DS.SCHEMAS[P.id];
    const keys = Object.keys(s.cols).filter((k) => P.rows.some((r) => r[k] != null && r[k] !== ""));
    el.innerHTML = `<div style="margin-top:14px;display:grid;gap:10px"><b>عدد السجلات المقروءة: ${P.rows.length}${P.sheet ? " من الورقة «" + esc(P.sheet) + "»" : ""}.</b>
      <span class="hint">الأعمدة المقروءة: ${esc(P.mapped.join("، "))}.${P.missing.length ? " غير موجودة: " + esc(P.missing.join("، ")) + "." : ""}</span>
      <div class="tbl"><table><thead><tr>${keys.map((k) => `<th>${esc(s.cols[k].label)}</th>`).join("")}</tr></thead><tbody>${P.rows.slice(0, 6).map((r) => `<tr>${keys.map((k) => `<td>${esc(s.cols[k].type === "date" ? U.dmy(r[k]) : r[k] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <div><button class="btn pri" type="button" id="dsCommit">اعتماد واستبدال البيانات</button> <button class="btn" type="button" id="dsCancel">إلغاء</button></div></div>`;
  }

  /* ---------- الرخص ---------- */
  const LCOL = { N8: "#4F7A8C", N7: "#9B6B3F", N5: "#7A5BA8", N4: "#D99A0B", N6: "#3F7CB5", N2: "#C2312A", N3: "#D9702B", N1: "#17715F", N9: "#6B747A" };
  function licensesApp(p, tab) {
    tab = tab || "overview";
    const allRows = HUB.licRows();
    // فترة التحليل: الرخص التي ينتهي تاريخها ضمن آخر N أشهر أو بعده (0 = الكل)
    const ps = ui.licPer ? new Date(U.today().getFullYear(), U.today().getMonth() - ui.licPer, U.today().getDate()) : null;
    const rows = ps ? allRows.filter((r) => U.parseISO(r.end) >= ps) : allRows;
    const hidOld = ps ? allRows.filter((r) => !r.closed && U.parseISO(r.end) < ps) : [];
    const perBar = `<div class="chips" style="align-items:center"><b style="margin-inline-end:6px">فترة التحليل:</b>${[[1, "آخر شهر"], [2, "آخر شهرين"], [3, "آخر 3 أشهر"], [0, "الكل"]].map(([n, l]) => `<button class="chip" type="button" data-licper="${n}" aria-pressed="${ui.licPer === n}">${l}</button>`).join("")}<span class="hint" style="margin:0 8px">${rows.length} من ${allRows.length} رخصة${ps ? " · من " + U.dmy(U.iso(ps)) : ""}</span></div>` + (hidOld.length ? `<div class="note">${hidOld.length} رخصة مفتوحة انتهت قبل بداية الفترة ولا تظهر في هذه الفترة: ${esc(hidOld.map((r) => r.loc + " (" + r.over + " يوماً)").join("، "))}</div>` : "");
    const open = rows.filter((r) => !r.closed);
    const over = open.filter((r) => r.over > 0).sort((a, b) => b.over - a.over);
    const age = U.daysFrom(S.licenses.asof);
    const tabs = [["overview", "التحليل"], ["list", "الرخص وأسباب التأخر", rows.length], ["eng", "حسب المهندس"], ["data", "تحديث البيانات"], ["site", "المنصة المنشورة"]];
    const stale = age > 14 ? `<div class="note">ملف الرخص بتاريخ ${U.dmy(S.licenses.asof)} (منذ ${U.days(age)}). أيام التجاوز محسوبة حتى اليوم؛ ارفع ملف الأسبوع من «تحديث البيانات» ليعكس الموقف الحالي.</div>` : "";
    let body = "";
    if (tab === "overview") {
      const cnt = {}; rows.forEach((r) => (cnt[r.cls] = (cnt[r.cls] || 0) + 1));
      const order = Object.keys(cnt).sort((a, b) => ((HUB.LIC_CLS[a] || {}).order || 99) - ((HUB.LIC_CLS[b] || {}).order || 99));
      const mx = Math.max(1, ...over.map((r) => r.over));
      body = stale + perBar + kpis([["إجمالي الرخص", rows.length], ["مغلقة بإخلاء طرف", rows.length - open.length, "ok"], ["مفتوحة", open.length, "warn"], ["متجاوزة المدة", over.length, "bad"], ["أقدم تجاوز (يوم)", over.length ? over[0].over : 0, "bad"]]) +
        `<div class="section two"><div class="panel"><h3>توزيع الرخص حسب الموقف</h3><p class="hint">الأعلى أبعدها عن الإغلاق.</p><div class="bars">${order.map((c) => `<div class="bar" style="--c:${LCOL[c]}"><span>${esc((HUB.LIC_CLS[c] || { short: "غير مصنفة" }).short || HUB.LIC_CLS[c].name)}</span><span class="tr"><span class="fl" style="width:${(cnt[c] / rows.length) * 100}%"></span></span><span class="v num">${cnt[c]}</span></div>`).join("")}</div></div>
        <div class="panel"><h3>ترتيب التجاوز</h3><p class="hint">أيام منذ انتهاء المدة للرخص المفتوحة.</p><div class="bars">${over.map((r) => `<div class="bar" style="--c:${LCOL[r.cls]}"><span>${esc(r.loc)} <span class="ltr num" style="color:var(--muted)">${r.id.slice(-5)}</span></span><span class="tr"><span class="fl" style="width:${(r.over / mx) * 100}%"></span></span><span class="v num">${r.over}</span></div>`).join("") || '<p class="hint">لا رخص متجاوزة.</p>'}</div></div></div>`;
    } else if (tab === "list") {
      const cnt = {}; rows.forEach((r) => (cnt[r.cls] = (cnt[r.cls] || 0) + 1));
      const q = ui.licQ.trim(), lf = ui.lf;
      const list = rows.filter((r) => (!ui.licF || r.cls === ui.licF) && (!q || (r.id + r.wo + r.loc + r.eng + r.st).includes(q))
          && (!lf.eng || r.eng === lf.eng) && (!lf.from || r.end >= lf.from) && (!lf.to || r.end <= lf.to)
          && (!lf.state || (lf.state === "open" ? !r.closed : lf.state === "closed" ? r.closed : lf.state === "over" ? !r.closed && r.over > 0 : lf.state === "soon" ? !r.closed && r.over <= 0 && r.over >= -30 : true)))
        .sort((a, b) => ((HUB.LIC_CLS[a.cls] || {}).order || 99) - ((HUB.LIC_CLS[b.cls] || {}).order || 99) || (b.over || 0) - (a.over || 0));
      ui.licList = list;
      ui.licDesc = [ui.licPer ? "آخر " + (ui.licPer === 1 ? "شهر" : ui.licPer === 2 ? "شهرين" : "3 أشهر") : "", ui.licF ? (HUB.LIC_CLS[ui.licF] || {}).name : "", lf.eng ? "المهندس: " + lf.eng : "", lf.state ? { open: "المفتوحة", over: "المتجاوزة", soon: "تنتهي خلال 30 يوماً", closed: "المغلقة" }[lf.state] : "", lf.from ? "انتهاء من " + U.dmy(lf.from) : "", lf.to ? "حتى " + U.dmy(lf.to) : "", q ? "بحث: " + q : ""].filter(Boolean).join(" · ") || "كل الرخص";
      body = stale + perBar + `<div class="chips"><button class="chip" data-licf="" aria-pressed="${!ui.licF}" type="button">الكل ${rows.length}</button>${Object.keys(cnt).map((c) => `<button class="chip" style="--c:${LCOL[c]}" data-licf="${c}" aria-pressed="${ui.licF === c}" type="button"><i></i>${esc((HUB.LIC_CLS[c] || {}).short || "غير مصنفة")} ${cnt[c]}</button>`).join("")}</div>
        <div class="panel" style="margin-bottom:14px"><div class="form">
          <label class="f">بحث<input type="search" id="licQ" value="${esc(ui.licQ)}" placeholder="رقم الرخصة، أمر العمل، الموقع، المهندس"></label>
          <label class="f">المهندس<select id="lfEng"><option value="">الكل</option>${[...new Set(rows.map((r) => r.eng).filter(Boolean))].map((e) => `<option ${e === lf.eng ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></label>
          <label class="f">الموقف<select id="lfState">${[["", "الكل"], ["open", "المفتوحة"], ["over", "المتجاوزة"], ["soon", "تنتهي خلال 30 يوماً"], ["closed", "المغلقة"]].map(([v, l]) => `<option value="${v}" ${v === lf.state ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="f">الانتهاء من<input type="date" id="lfFrom" value="${esc(lf.from)}"></label>
          <label class="f">حتى<input type="date" id="lfTo" value="${esc(lf.to)}"></label>
          <div><button class="btn sm" type="button" data-lfreset>مسح الفلاتر</button></div>
        </div>${expBar(ui.licDesc, list.length, "data-lexp")}</div>
        <div class="tbl"><table><thead><tr><th>الرخصة</th><th>الموقع</th><th>المهندس</th><th>الانتهاء</th><th>الحالة</th><th>سبب التأخر</th><th>الإجراء المطلوب</th></tr></thead><tbody>
        ${list.map((r) => `<tr><td class="ltr num">${esc(r.id)}<br><small style="color:var(--muted)">أمر ${esc(r.wo)}</small></td><td>${esc(r.loc)}</td><td>${esc(r.eng)}</td><td class="num">${U.dmy(r.end)}</td>
          <td>${r.closed ? '<span class="pill p-ok">مغلقة</span>' : r.over > 0 ? `<span class="pill p-bad">متجاوزة ${r.over} يوم</span>` : `<span class="pill p-warn">سارية ${-r.over} يوم</span>`}<br><small style="color:var(--muted)">${esc(r.clsName)}</small></td>
          <td class="wrap">${esc(r.why || "")}</td><td class="wrap">${esc(r.act)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">لا نتائج مطابقة.</td></tr>`}</tbody></table></div>`;
    } else if (tab === "eng") {
      const engs = [...new Set(rows.map((r) => r.eng || "غير محدد"))];
      const data = engs.map((e) => { const a = rows.filter((r) => (r.eng || "غير محدد") === e), o = a.filter((r) => !r.closed), ov = o.filter((r) => r.over > 0); return { e, a: a.length, o: o.length, ov: ov.length, max: ov.length ? Math.max(...ov.map((r) => r.over)) : 0 }; }).sort((x, y) => y.ov - x.ov || y.o - x.o);
      body = stale + perBar + `<div class="tbl"><table><thead><tr><th>المهندس</th><th>إجمالي الرخص</th><th>مغلقة</th><th>مفتوحة</th><th>متجاوزة</th><th>أقدم تجاوز (يوم)</th><th>نسبة الإغلاق</th></tr></thead><tbody>
        ${data.map((d) => `<tr><td>${esc(d.e)}</td><td class="num">${d.a}</td><td class="num">${d.a - d.o}</td><td class="num">${d.o}</td><td class="num">${d.ov ? `<span class="pill p-bad">${d.ov}</span>` : 0}</td><td class="num">${d.max || "—"}</td><td class="num">${Math.round(((d.a - d.o) / d.a) * 100)}%</td></tr>`).join("")}</tbody></table></div>`;
    } else if (tab === "data") {
      body = `<div class="panel"><h3>رفع ملف الرخص الأسبوعي</h3><p class="hint">ملف Excel أو CSV يحتوي أعمدة: رقم الرخصة/التصريح، أمر العمل، الموقع، تاريخ الانتهاء، موقف الرخصة، المهندس. تُكتشف الأعمدة من العناوين، ويُعاد التصنيف وأسباب التأخر تلقائياً.</p>
        <div class="drop" id="licDrop"><p style="margin:0 0 10px">اسحب الملف هنا أو اختره</p><input type="file" id="licFile" accept=".xlsx,.xls,.csv"></div>
        <label class="f" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="licSwap" checked style="width:auto"> تصحيح التواريخ المقلوبة (اليوم ≤ 12 يُقرأ يوم↔شهر) — مشكلة معروفة في ملف الرخص الأسبوعي</label>
        <div id="licPend"></div><p class="msg" id="licMsg" role="status"></p></div>
        <div class="panel section"><h3>تنزيل الموقف الحالي</h3><p class="hint">${rows.length} رخصة، ملف بتاريخ ${U.dmy(S.licenses.asof)}.</p><button class="btn" type="button" data-csv="licenses">تنزيل CSV</button></div>`;
      if (ui.pendLic) setTimeout(renderLicPend, 0);
    } else body = frame(p.url, "منصة الرخص المنشورة");
    view.innerHTML = appShell(p, tabs, tab, body);
  }

  const KW = { id: ["رقم التصريح", "رقم الرخص", "التصريح", "الرخصة"], wo: ["امر العمل", "أمر العمل"], loc: ["الموقع"], end: ["تاريخ الانتهاء", "انتهاء"], st: ["موقف الرخص", "الحالة", "موقف"], eng: ["المهندس"] };
  function sheetRows(buf) { const wb = XLSX.read(buf, { type: "array", cellDates: true }); const ws = wb.Sheets[wb.SheetNames.find((n) => n.includes("تحديث")) || wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }); }
  function cellDate(v, swap) {
    if (v instanceof Date) { const t = new Date(v.getTime() + 12 * 36e5); let y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate(); if (swap && d <= 12 && d !== m) [d, m] = [m, d]; return U.iso(new Date(y, m - 1, d)); }
    if (typeof v === "number") return U.iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5 + 12 * 36e5));
    const s = U.toEn(v).trim(); let k = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (k) { let y = +k[3]; if (y < 100) y += 2000; return U.iso(new Date(y, +k[2] - 1, +k[1])); }
    k = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (k) return U.iso(new Date(+k[1], +k[2] - 1, +k[3]));
    return null;
  }
  function genWhy(r) {
    const o = U.daysFrom(r.end), late = `الرخصة منتهية ${U.dmy(r.end)} (${o > 0 ? "متأخرة " + U.days(o) : "سارية"}).`, st = r.st;
    return ({ N1: `لا تأخر قائم: حالة الملف "${st}".`, N2: `الثابت: "${st}". ${late} المرجّح: التعديل المطلوب لم يُنفذ أو لم يُعد رفعه.`, N3: `الثابت: الإخلاء ينتظر السداد ("${st}"). ${late} المرجّح: غياب موعد ثابت للسداد.`, N4: `الثابت: "${st}". ${late} المرجّح: ملاحظات على المراحل أو انتظار معاينة.`, N5: `الثابت: "${st}"؛ العمل الميداني انتهى وبقي إجراء إداري. ${late}`, N6: `الثابت: "${st}" ولم تُسجل نتيجة. ${late} المرجّح: تقرير المختبر لم يصل.`, N7: `الثابت: "تحت التنفيذ" بعد انتهاء المدة ولا تمديد مسجل. ${late}`, N9: `حالة غير مصنفة: "${st}". ${late}` })[r.cls];
  }
  function parseLicenses(buf, swap) {
    const rows = sheetRows(buf);
    let hi = -1, best = 0;
    rows.slice(0, 15).forEach((r, i) => { const n = Object.values(KW).filter((k) => r.some((c) => k.some((w) => String(c).includes(w)))).length; if (n > best) { best = n; hi = i; } });
    if (best < 3) throw new Error("لم أجد صف العناوين. تأكد أن الملف فيه أعمدة رقم الرخصة والموقع وتاريخ الانتهاء.");
    const h = rows[hi].map((c) => String(c).trim()), col = {};
    Object.keys(KW).forEach((k) => { for (const w of KW[k]) { const i = h.findIndex((c) => c.includes(w)); if (i >= 0) { col[k] = i; break; } } });
    const prev = new Map((S.licenses.rows || []).map((r) => [r.id, r]));
    const out = [], skipped = [];
    rows.slice(hi + 1).forEach((r) => {
      const id = U.toEn(r[col.id]).replace(/\D/g, ""); if (!id) return;
      const end = col.end != null ? cellDate(r[col.end], swap) : null;
      if (!end) { skipped.push(id); return; }
      const x = { id, wo: col.wo != null ? U.toEn(r[col.wo]).trim() : "", loc: col.loc != null ? String(r[col.loc]).trim() : "", eng: col.eng != null ? String(r[col.eng]).replace(/^م[\/\\]\s*/, "").trim() : "", end, st: col.st != null ? String(r[col.st]).trim() : "" };
      x.cls = HUB.classify(x.st);
      const p = prev.get(id);
      x.why = p && p.cls === x.cls && p.why ? p.why : genWhy(x);
      out.push(x);
    });
    return { list: out, skipped };
  }
  function renderLicPend() {
    const el = $("#licPend"); if (!el || !ui.pendLic) return;
    const P = ui.pendLic, old = new Set((S.licenses.rows || []).map((r) => r.id));
    const nw = P.list.filter((r) => !old.has(r.id)).length;
    el.innerHTML = `<div style="margin-top:14px;display:grid;gap:10px"><b>قرأت ${P.list.length} رخصة: ${nw} جديدة و${P.list.length - nw} موجودة سابقاً.</b>${P.skipped.length ? `<div class="note">تخطيت ${P.skipped.length} صفاً بتاريخ غير مفهوم: ${esc(P.skipped.slice(0, 6).join("، "))}</div>` : ""}
      <div class="tbl"><table><thead><tr><th>الرخصة</th><th>الموقع</th><th>الانتهاء</th><th>الموقف</th></tr></thead><tbody>${P.list.slice(0, 8).map((r) => `<tr><td class="ltr">${r.id}</td><td>${esc(r.loc)}</td><td>${U.dmy(r.end)}</td><td>${esc(r.st)}</td></tr>`).join("")}</tbody></table></div>
      <div><button class="btn pri" type="button" id="licCommit">اعتماد واستبدال ملف الرخص</button> <button class="btn" type="button" id="licCancel">إلغاء</button></div></div>`;
  }

  /* ---------- بطاقات السلامة ---------- */
  const SCOL = { expired: "var(--bad)", week: "var(--warn)", soon: "var(--volt)", valid: "var(--ok)" };
  const SP = { expired: "p-bad", week: "p-warn", soon: "p-warn", valid: "p-ok" };
  // تطبيق بطاقات السلامة نفسه المنشور مستقلاً على najran-safety-cards.netlify.app — يُركّب هنا داخل البوابة
  let saInst = null;
  function safetyApp(p) {
    view.innerHTML = `<div class="app-head"><div><h1>${esc(p.name)}</h1><p>${esc(p.purpose)} · التطبيق نفسه يعمل داخل البوابة وعلى رابطه المستقل، والبيانات واحدة.</p></div>
      <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">افتح المنصة في نافذة جديدة</a></div><div id="saMount" style="margin-top:18px"></div>`;
    saInst = SafetyApp.mount($("#saMount"), { api: "/api/data", seed: S.cards, onChange: (v) => { S.cards = v; U.ls.set("cards", v); U.ls.set("ctxAt", 0); HUB.pushContext(); E = HUB.evaluateAll(); } });
  }
  const CMAP = { emp: /^emp/, name: /name|الاسم/, iqama: /iqama|الإقامة|الاقامة/, badge: /badge|بطاقةالمقاول/, sap: /^sap/, exp: /expiry|انتهاء/, remark: /remark|ملاحظ/ };
  function parseCardDate(v) {
    if (v instanceof Date) return cellDate(v, false);
    if (typeof v === "number") return cellDate(v, false);
    const s = String(v || "").trim(); let m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2,4})$/);
    if (m) { const k = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[2].slice(0, 3).toLowerCase()); if (k < 0) return null; let y = +m[3]; if (y < 100) y += 2000; return U.iso(new Date(y, k, +m[1])); }
    return cellDate(s, false);
  }
  function parseCards(buf) {
    const rows = sheetRows(buf); let hi = -1, col = {};
    for (let i = 0; i < Math.min(rows.length, 30) && hi < 0; i++) { const cm = {}; rows[i].forEach((h, j) => { const t = String(h).toLowerCase().replace(/\s+/g, ""); Object.keys(CMAP).forEach((k) => { if (cm[k] == null && t && CMAP[k].test(t)) cm[k] = j; }); }); if (cm.emp != null && cm.exp != null) { hi = i; col = cm; } }
    if (hi < 0) throw new Error("لم أجد صف العناوين. لازم يكون فيه عمود رقم الموظف وعمود تاريخ الانتهاء.");
    const g = (r, k) => (col[k] != null ? String(r[col[k]] ?? "").trim().replace(/^-$/, "") : "");
    const out = [], skipped = [], seen = {};
    rows.slice(hi + 1).forEach((r) => { const emp = g(r, "emp"); if (!emp) return; const exp = parseCardDate(r[col.exp]); if (!exp) { skipped.push(emp); return; } if (seen[emp]) return; seen[emp] = 1; out.push({ emp, name: g(r, "name").replace(/\s+/g, " "), iqama: g(r, "iqama"), badge: g(r, "badge"), sap: g(r, "sap"), exp, remark: g(r, "remark") }); });
    return { list: out, skipped };
  }
  function renderCardPend() {
    const el = $("#cardPend"); if (!el || !ui.pendCards) return; const P = ui.pendCards;
    el.innerHTML = `<div style="margin-top:14px;display:grid;gap:10px"><b>قرأت ${P.list.length} بطاقة.</b>${P.skipped.length ? `<div class="note">تخطيت ${P.skipped.length} صفاً: ${esc(P.skipped.slice(0, 6).join("، "))}</div>` : ""}<div><button class="btn pri" type="button" id="cardCommit">اعتماد واستبدال السجل</button> <button class="btn" type="button" id="cardCancel">إلغاء</button></div></div>`;
  }

  /* ---------- الإعدادات ---------- */
  function settings() {
    view.innerHTML = `<div class="app-head"><div><h1>إعدادات البوابة</h1><p>تخص هذا الجهاز فقط.</p></div></div>
      <div class="section two"><div class="panel"><h3>رمز الإدارة</h3><p class="hint">إن فُعّل رمز للحفظ على Netlify (متغير HUB_ADMIN_PIN) فاكتبه هنا ليُسمح لهذا الجهاز بحفظ القراءات ورفع الملفات.</p>
        <form class="form" id="pinForm"><label class="f">الرمز<input type="password" id="pin" value="${esc(U.ls.get("pin") || "")}" autocomplete="off"></label><div><button class="btn pri" type="submit">حفظ الرمز</button></div></form><p class="msg" id="pinMsg" role="status"></p></div>
        <div class="panel"><h3>المظهر</h3><p class="hint">يتبع إعداد الجهاز افتراضياً.</p><div class="chips">${["auto:تلقائي", "light:فاتح", "dark:داكن"].map((x) => { const [k, l] = x.split(":"); return `<button class="chip" type="button" data-theme="${k}" aria-pressed="${(U.ls.get("theme") || "auto") === k}">${l}</button>`; }).join("")}</div></div>
        <div class="panel"><h3>حالة الاتصال</h3><p class="hint">${Store.online ? "متصل بقاعدة البيانات المشتركة: كل ما تحفظه يظهر على كل الأجهزة." : "غير متصل بالقاعدة المشتركة: الحفظ على هذا المتصفح فقط حتى يعود الاتصال."}</p></div>
        <div class="panel"><h3>إضافة منصة جديدة</h3><p class="hint">تُضاف المنصة بعنصر واحد في الملف public/js/registry.js (الاسم، الرابط، المؤشرات، وقاعدة الحالة) فتظهر في القائمة والرئيسية والمساعد تلقائياً.</p></div></div>`;
  }

  /* ---------- الموجّه ---------- */
  function parse() { const h = location.hash.replace(/^#\/?/, "").split("/"); if (h[0] === "app" && reg(h[1])) return { name: "app", app: h[1], tab: h[2] }; if (h[0] === "settings") return { name: "settings" }; return { name: "home" }; }
  function render() {
    E = HUB.evaluateAll();
    const r = parse();
    renderNav(r);
    $("#crumb").textContent = r.name === "app" ? reg(r.app).name : r.name === "settings" ? "إعدادات البوابة" : "الصفحة الرئيسية";
    if (r.name === "home") home();
    else if (r.name === "settings") settings();
    else { const p = reg(r.app); if (p.kind === "linked") linkedApp(p, r.tab); else if (p.id === "licenses") licensesApp(p, r.tab); else safetyApp(p); }
    $("#side").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  }
  let lastApp = null;
  window.addEventListener("hashchange", () => { const a = parse().app; if (a !== lastApp) { ui.dsF = ""; ui.dsQ = ""; ui.df = { dims: {}, state: "", from: "", to: "" }; lastApp = a; } render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- الأحداث ---------- */
  function download(name, rows) {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const blob = new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n\r\n" + q("Project Manager | Eng. Ahmed Zahran")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-hper],[data-dexp],[data-dlexp],[data-lexp],[data-dfreset],[data-lfreset],[data-licper],#syncNow,[data-dsf],[data-tpl],[data-dscsv],[data-dsclear],[data-dsparse],#dsCommit,#dsCancel,[data-go],[data-licf],[data-csv],[data-theme],#licCommit,#licCancel,#cardCommit,#cardCancel,#genSummary,#settingsBtn,#menuBtn");
    if (!t) return;
    if (t.dataset.go) { location.hash = t.dataset.go; return; }
    if (t.id === "menuBtn") { const o = $("#side").classList.toggle("open"); t.setAttribute("aria-expanded", String(o)); return; }
    if (t.id === "settingsBtn") { location.hash = "#/settings"; return; }
    if (t.dataset.licf !== undefined) { ui.licF = t.dataset.licf; render(); return; }
    if (t.dataset.hper) { const hp = U.ls.get(HP_KEY) || {}; const k = t.dataset.hper; hp.per = k === "1" ? 1 : k === "3" ? 3 : k; U.ls.set(HP_KEY, hp); render(); return; }
    if (t.dataset.dexp || t.dataset.dlexp) {
      const p = reg(parse().app), A = DS.analyze(p.id, S.ds[p.id]);
      if (t.dataset.dexp) dsExport(t.dataset.dexp, p, A, dsFiltered(A), dsDesc(A));
      else dsExport(t.dataset.dlexp, p, A, A.late, "المتأخرة: " + (A.s.slaText || "تجاوزت موعدها"));
      return;
    }
    if (t.dataset.lexp) {
      const list = ui.licList || [];
      exportReport(t.dataset.lexp, { title: "موقف الرخص", desc: ui.licDesc || "كل الرخص", count: list.length, file: "licenses",
        head: ["رقم الرخصة", "أمر العمل", "الموقع", "المهندس", "تاريخ الانتهاء", "الموقف في الملف", "التصنيف", "الحالة", "التجاوز (يوم)", "سبب التأخر", "الإجراء المطلوب"],
        rows: list.map((r) => [r.id, r.wo, r.loc, r.eng, U.dmy(r.end), r.st, r.clsName, r.closed ? "مغلقة" : r.over > 0 ? "متجاوزة" : "سارية", r.closed ? "" : r.over, r.why || "", r.act]) });
      return;
    }
    if (t.dataset.dfreset !== undefined) { ui.df = { dims: {}, state: "", from: "", to: "" }; ui.dsF = ""; ui.dsQ = ""; render(); return; }
    if (t.dataset.lfreset !== undefined) { ui.lf = { eng: "", state: "", from: "", to: "" }; ui.licF = ""; ui.licQ = ""; render(); return; }
    if (t.dataset.licper !== undefined) { ui.licPer = +t.dataset.licper; ui.licF = ""; render(); return; }
    if (t.id === "syncNow") {
      const m = $("#syncMsg"); t.disabled = true; m.className = "msg"; m.textContent = "جارٍ السحب من المنصات الأصلية…";
      try {
        const r = await fetch("/api/sync", { method: "POST", headers: { "x-hub-pin": U.ls.get("pin") || "" } });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
        for (const id of Object.keys(DS.AUTO)) { const v = await Store.get("ds_" + id); if (v && v.rows && v.rows.length) S.ds[id] = v; }
        U.ls.set("ctxAt", 0); HUB.pushContext(); render();
        const m2 = $("#syncMsg"); if (m2) { m2.className = "msg ok"; m2.textContent = "تمت المزامنة: " + Object.entries(j.report).map(([k, v]) => k + " " + v).join("، "); }
      } catch (e) { m.className = "msg err"; m.textContent = "تعذّرت المزامنة: " + (e.message || e); t.disabled = false; }
      return;
    }
    if (t.dataset.dsf !== undefined) { ui.dsF = t.dataset.dsf; render(); return; }
    if (t.dataset.tpl) { download(`template-${t.dataset.tpl}.csv`, DS.template(t.dataset.tpl)); return; }
    if (t.dataset.dscsv) { const s = DS.SCHEMAS[t.dataset.dscsv], keys = Object.keys(s.cols); download(`${t.dataset.dscsv}-${U.iso(U.today())}.csv`, [keys.map((k) => s.cols[k].label)].concat(S.ds[t.dataset.dscsv].rows.map((r) => keys.map((k) => r[k] ?? "")))); return; }
    if (t.dataset.dsclear) { if (!confirm("حذف بيانات هذه المنصة من القاعدة المشتركة؟")) return; const id = t.dataset.dsclear; await Store.put("ds_" + id, { rows: [] }); delete S.ds[id]; U.ls.set("ctxAt", 0); render(); return; }
    if (t.dataset.dsparse) { const m = $("#dsMsg"); try { const r = DS.parsePaste($("#dsPaste").value, t.dataset.dsparse); if (!r.rows.length) throw new Error("لم أجد صفوفاً تحت العناوين."); ui.pendDs = { id: t.dataset.dsparse, ...r }; renderDsPend(); m.className = "msg"; m.textContent = "راجع العينة ثم اعتمد."; } catch (e) { m.className = "msg err"; m.textContent = e.message; } return; }
    if (t.id === "dsCancel") { ui.pendDs = null; $("#dsPend").innerHTML = ""; return; }
    if (t.id === "dsCommit") {
      t.disabled = true; const P = ui.pendDs;
      const val = { asof: U.iso(U.today()), rows: P.rows, mapped: P.mapped, missing: P.missing, sheet: P.sheet || "" };
      const r = await Store.put("ds_" + P.id, val);
      if (!r.ok) { $("#dsMsg").className = "msg err"; $("#dsMsg").textContent = r.error; t.disabled = false; return; }
      S.ds[P.id] = val; ui.pendDs = null; ui.dsF = ""; ui.dsQ = ""; U.ls.set("ctxAt", 0); HUB.pushContext();
      location.hash = link(P.id, "overview"); render(); return;
    }
    if (t.dataset.theme) { const k = t.dataset.theme; U.ls.set("theme", k); applyTheme(); render(); return; }
    if (t.dataset.csv === "licenses") download(`licenses-${U.iso(U.today())}.csv`, [["رقم الرخصة", "أمر العمل", "الموقع", "المهندس", "الانتهاء", "الموقف", "الحالة", "أيام التجاوز", "السبب", "الإجراء"]].concat(HUB.licRows().map((r) => [r.id, r.wo, r.loc, r.eng, r.end, r.clsName, r.closed ? "مغلقة" : "مفتوحة", r.closed ? "" : r.over, r.why, r.act])));
    if (t.dataset.csv === "cards") download(`safety-cards-${U.iso(U.today())}.csv`, [["رقم الموظف", "الاسم", "الإقامة", "بطاقة المقاول", "SAP", "الانتهاء", "الأيام المتبقية", "الحالة", "ملاحظات"]].concat(HUB.cardRows().map((c) => [c.emp, c.name, c.iqama, c.badge, c.sap, c.exp, c.left, HUB.CARD_ST[c.st], c.remark])));
    if (t.id === "licCancel") { ui.pendLic = null; $("#licPend").innerHTML = ""; }
    if (t.id === "cardCancel") { ui.pendCards = null; $("#cardPend").innerHTML = ""; }
    if (t.id === "licCommit") {
      t.disabled = true;
      const val = { asof: U.iso(U.today()), cls: SEED.licenses.cls, rows: ui.pendLic.list };
      const r = await Store.put("licenses", val);
      if (!r.ok) { $("#licMsg").className = "msg err"; $("#licMsg").textContent = r.error; t.disabled = false; return; }
      S.licenses = val; ui.pendLic = null; U.ls.set("ctxAt", 0); HUB.pushContext();
      location.hash = link("licenses", "overview"); render();
    }
    if (t.id === "cardCommit") {
      t.disabled = true;
      const val = { asof: U.iso(U.today()), rows: ui.pendCards.list };
      const r = await Store.put("cards", val);
      if (!r.ok) { $("#cardMsg").className = "msg err"; $("#cardMsg").textContent = r.error; t.disabled = false; return; }
      S.cards = val; ui.pendCards = null; U.ls.set("ctxAt", 0); HUB.pushContext();
      location.hash = link("safety", "overview"); render();
    }
    if (t.id === "genSummary") {
      const m = $("#sumMsg"); m.className = "msg"; m.textContent = "المساعد يكتب الملخص…"; t.disabled = true;
      const res = await window.ASSIST.ask("اكتب ملخص اليوم للإدارة العليا في 6 أسطر كحد أقصى", { silent: true });
      const val = { text: res.text, at: new Date().toISOString(), by: res.ai ? "ai" : "local" };
      await Store.put("summary", val); S.summary = val; render();
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "licQ") { ui.licQ = ev.target.value; render(); const i = $("#licQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (ev.target.id === "dsQ") { ui.dsQ = ev.target.value; render(); const i = $("#dsQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (ev.target.id === "cardQ") { ui.cardQ = ev.target.value; render(); const i = $("#cardQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  document.addEventListener("change", (ev) => {
    const tg = ev.target;
    if (tg.dataset && tg.dataset.dfdim) { ui.df.dims[tg.dataset.dfdim] = tg.value; render(); return; }
    if (tg.id === "hpFrom" || tg.id === "hpTo") { const hp = U.ls.get(HP_KEY) || { per: "custom" }; hp.per = "custom"; hp[tg.id === "hpFrom" ? "from" : "to"] = tg.value; U.ls.set(HP_KEY, hp); render(); return; }
    const map = { dfState: ["df", "state"], dfFrom: ["df", "from"], dfTo: ["df", "to"], lfEng: ["lf", "eng"], lfState: ["lf", "state"], lfFrom: ["lf", "from"], lfTo: ["lf", "to"] };
    if (map[tg.id]) { ui[map[tg.id][0]][map[tg.id][1]] = tg.value; render(); return; }
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const isLic = ev.target.id === "licFile", isCard = ev.target.id === "cardFile", isDs = ev.target.id === "dsFile"; if (!isLic && !isCard && !isDs) return;
    const m = $(isLic ? "#licMsg" : isCard ? "#cardMsg" : "#dsMsg"), dsId = ev.target.dataset.app;
    if (typeof XLSX === "undefined") { m.className = "msg err"; m.textContent = "مكتبة قراءة Excel لم تُحمّل بعد. تحقق من الاتصال وأعد المحاولة."; return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const buf = new Uint8Array(rd.result);
        if (isDs) { const r = DS.parseFile(buf, dsId); if (!r.rows.length) throw new Error("لم أجد صفوفاً تحت العناوين."); ui.pendDs = { id: dsId, ...r }; renderDsPend(); }
        else if (isLic) { ui.pendLic = parseLicenses(buf, $("#licSwap").checked); renderLicPend(); }
        else { ui.pendCards = parseCards(buf); renderCardPend(); }
        m.className = "msg"; m.textContent = "راجع الأرقام ثم اعتمد.";
      } catch (e) { m.className = "msg err"; m.textContent = e.message || "تعذّرت قراءة الملف."; }
    };
    rd.readAsArrayBuffer(f);
  });
  document.addEventListener("submit", async (ev) => {
    if (ev.target.id === "snapForm") {
      ev.preventDefault();
      const fd = new FormData(ev.target), id = ev.target.dataset.app, p = reg(id), m = $("#snapMsg");
      const values = {}; p.fields.forEach((f) => { const v = fd.get(f.key); if (v !== "" && v != null) values[f.key] = Number(v); });
      if (!Object.keys(values).length) { m.className = "msg err"; m.textContent = "أدخل رقماً واحداً على الأقل."; return; }
      const date = fd.get("date"), note = String(fd.get("note") || "").trim();
      const all = { ...S.snapshots }; const arr = (all[id] || []).filter((s) => s.date !== date);
      arr.push({ date, values, note, at: new Date().toISOString() }); arr.sort((a, b) => (a.date < b.date ? -1 : 1)); all[id] = arr.slice(-400);
      const r = await Store.put("snapshots", all);
      if (!r.ok) { m.className = "msg err"; m.textContent = r.error; return; }
      S.snapshots = all; U.ls.set("ctxAt", 0); HUB.pushContext();
      location.hash = link(id, "summary"); render();
      return;
    }
    if (ev.target.id === "pinForm") { ev.preventDefault(); U.ls.set("pin", $("#pin").value.trim()); $("#pinMsg").className = "msg ok"; $("#pinMsg").textContent = "حُفظ الرمز على هذا الجهاز."; }
  });

  function applyTheme() { const t = U.ls.get("theme") || "auto"; if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }

  /* ---------- الإقلاع ---------- */
  async function boot() {
    applyTheme();
    $("#today").textContent = U.longDate();
    view.innerHTML = `<div class="empty">جارٍ تحميل بيانات الفرع…</div>`;
    await HUB.loadAll();
    $("#syncTxt").textContent = Store.online ? "متصل بقاعدة البيانات المشتركة" : "وضع محلي: الحفظ على هذا الجهاز";
    render();
    HUB.pushContext();
  }
  window.VIEWS = { render };
  boot();
})();
