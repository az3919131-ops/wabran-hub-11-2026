/* الصفحات: الرئيسية، المنصات المرتبطة، الرخص، بطاقات السلامة، الإعدادات — مع موجّه بسيط بالـ hash. */
(function () {
  "use strict";
  const { U, Store, S } = HUB;
  const { $, esc } = U;
  const view = $("#view");
  const LV = { ok: "سليم", warn: "يحتاج متابعة", bad: "يحتاج قراراً", none: "بلا بيانات" };
  const LVC = { ok: "var(--ok)", warn: "var(--volt)", bad: "var(--bad)", none: "var(--none)" };
  const reg = (id) => REGISTRY.find((p) => p.id === id);
  // صلاحيات المستخدم الحالي
  const lvl = (id) => (HUB.user && HUB.user.access ? HUB.user.access[id] || "none" : "none");
  const canEditP = (id) => lvl(id) === "edit";
  const canExpP = (id) => lvl(id) === "edit" || lvl(id) === "export";
  const hasCap = (c) => !!(HUB.user && HUB.user.caps && HUB.user.caps.includes(c));
  const link = (app, tab) => `#/app/${app}${tab ? "/" + tab : ""}`;
  let E = null;
  const ui = { dpDate: "", ddDate: "", ddSt: "", df: { dims: {}, state: "", from: "", to: "" }, lf: { eng: "", state: "", from: "", to: "" }, licPer: 0, licF: "", licQ: "", cardQ: "", pendLic: null, pendCards: null, dsF: "", dsQ: "", pendDs: null };

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
  U.ls.set(HP_KEY, { per: "all", from: "", to: "" }); // كل تشغيل للمنصة يبدأ بفترة «الكل»
  function homePeriod() {
    const hp = U.ls.get(HP_KEY) || { per: "all", from: "", to: "" };
    const t = U.today();
    if (hp.per === 1 || hp.per === 3) { const d = new Date(t.getFullYear(), t.getMonth() - hp.per, t.getDate()); return { hp, period: { from: U.iso(d), to: "", months: hp.per }, label: hp.per === 1 ? "آخر شهر" : "آخر 3 أشهر", from: U.iso(d) }; }
    if (hp.per === "custom" && (hp.from || hp.to)) {
      // عدد أشهر الفترة المخصصة (لحساب المتوسط الشهري)، بحد أدنى شهر واحد
      const f = hp.from ? U.parseISO(hp.from) : null, e = hp.to ? U.parseISO(hp.to) : t;
      const months = f ? Math.max(1, Math.round(((e - f) / 864e5 + 1) / 30.44)) : null;
      return { hp, period: { from: hp.from, to: hp.to, months }, label: "فترة مخصصة", from: hp.from };
    }
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

    // تحليل أداء الفرع: 50% فأكثر أداء جيد (أخضر)، وأقل من 50% يحتاج تحسيناً (أحمر)
    const perfC = (v) => (v == null ? "var(--none)" : v >= 50 ? "var(--ok)" : "var(--bad)");
    const tiers = E.items.map((i) => `<button class="tier ${i.score == null ? "none" : ""}" style="--c:${perfC(i.score)}" data-go="${link(i.id)}" type="button" aria-label="${esc(i.name)}: ${i.score == null ? "بلا بيانات" : i.score + "%"}">
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
    const hr = new Date().getHours(), greet = hr < 12 ? "صباح الخير" : "مساء الخير";
    view.innerHTML = `
      <section class="nj-hero">${window.NJ ? NJ.scene("home") : ""}<div class="nj-hero-text"><p class="nj-greet">${greet}، ${esc((HUB.user && HUB.user.name) || "")}</p><h1>مشاريع قطاع الطاقة في نجران</h1><p class="nj-sub">${U.longDate()} · ${E.covered} من ${E.total} منصات لها بيانات اليوم</p></div></section>
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
          <h2>تحليل أداء الفرع <span class="num" style="color:${perfC(E.overall)}">${E.overall ?? "—"}%</span></h2>
          <p>${E.overall == null ? "" : E.overall >= 50 ? "أداء الفرع جيد. " : "أداء الفرع يحتاج تحسيناً. "}كل طبقة قسم؛ طولها نسبة أدائه. الأخضر 50% فأكثر أداء جيد، والأحمر أقل من 50%، والمخططة بلا بيانات.</p>
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
        ${hasCap("assistant") ? `<div class="acts" style="margin-top:12px"><button class="btn" type="button" id="genSummary">اكتب الملخص الآن واحفظه</button></div>` : ""}
        <p class="msg" id="sumMsg" role="status"></p>
      </section>
      <section class="section panel brief-bottom">
        <div class="brief">
          <div class="acts"><button class="btn pri" type="button" data-ask="اكتب ملخص اليوم للإدارة العليا">ملخص اليوم من المساعد</button><a class="btn" href="#gaps">نواقص البيانات (${E.gaps.length})</a></div>
        </div>
      </section>`;
  }

  /* ---------- رأس التطبيق والتبويبات ---------- */
  const BACK = `<a class="btn back-home" href="#/" aria-label="رجوع للصفحة الرئيسية">→ الرئيسية</a>`;
  // فتح المنصة الأصلية داخل إطار منصة الوبران (شريط علوي برجوع للرئيسية) أو مستقلة
  const openBtns = (p) => p.ownStorage
    ? `<span class="open-btns"><a class="btn pri" href="${esc(p.url)}" target="_blank" rel="noopener">فتح المنصة ببياناتك ↗</a></span>`
    : `<span class="open-btns"><a class="btn pri" href="#/go/${p.id}">فتح المنصة كاملة</a><a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">فتح مستقل</a></span>`;
  const OWN_MSG = (p) => `<div class="panel empty own-store"><h3>${esc(p.name)} تُفتح في تبويب مستقل</h3><p>جداولك المحفوظة (المركبات والأفراد والمواقع والأيام السابقة) محفوظة في متصفحك على عنوان المنصة نفسها. عند عرضها داخل منصة الوبران يعطيها المتصفح مساحة تخزين منفصلة فارغة، لذلك تُفتح في تبويبها لتظهر بياناتك كاملة وتستمر مزامنتها مع منصة الوبران.</p><a class="btn pri" href="${esc(p.url)}" target="_blank" rel="noopener">فتح ${esc(p.short)} ببياناتك ↗</a></div>`;

  /* ---------- عرض المنصة كاملة داخل إطار الوبران: شريط علوي ثابت فيه الرجوع والتنقل ---------- */
  function goPage(p) {
    document.body.classList.add("go-mode");
    const others = REGISTRY.filter((x) => x.url);
    document.getElementById("goBar") && document.getElementById("goBar").remove();
    const bar = document.createElement("div");
    bar.id = "goBar"; bar.className = "go-bar"; bar.setAttribute("dir", "rtl");
    bar.innerHTML = `<a class="go-home" href="#/">→ الصفحة الرئيسية</a><b>منصة الوبران · نجران</b><span class="go-sep"></span>
      <a class="go-link" href="${link(p.id)}">تحليل ${esc(p.short)} في المنصة</a>
      <select id="goSel" aria-label="التنقل بين المنصات">${others.map((x) => `<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <a class="go-link" href="${esc(p.url)}" target="_blank" rel="noopener">فتح مستقل ↗</a>`;
    document.body.appendChild(bar);
    view.innerHTML = p.ownStorage ? `<div style="margin-top:70px">${OWN_MSG(p)}</div>` : p.noFrame
      ? `<div class="panel empty" style="margin-top:70px"><h3>${esc(p.name)} لا تسمح بالعرض داخل منصة أخرى</h3><p>المنصة الأصلية مضبوطة لمنع العرض داخل المواقع الأخرى، فتُفتح في تبويب مستقل. ارجع للرئيسية من هذا الشريط أو من زر الرجوع في المتصفح.</p><a class="btn pri" href="${esc(p.url)}" target="_blank" rel="noopener">فتح ${esc(p.short)} في تبويب جديد</a></div>`
      : `<iframe class="go-frame" src="${esc(p.url)}" title="${esc(p.name)}" referrerpolicy="no-referrer"></iframe>`;
  }

  function appShell(p, tabs, tab, body) {
    return `<div class="app-head nj-band">${window.NJ ? NJ.scene("band") : ""}<div>${BACK}<h1>${esc(p.name)}</h1><p>${esc(p.purpose)}</p></div>
      ${p.url ? openBtns(p) : ""}</div>
      <div class="tabs" role="tablist">${tabs.map((t) => `<button role="tab" type="button" data-go="${link(p.id, t[0])}" aria-selected="${t[0] === tab}">${t[1]}${t[2] != null ? ` <span class="count num">${t[2]}</span>` : ""}</button>`).join("")}</div>
      <div role="tabpanel">${body}</div>`;
  }
  // المنصات المستقلة المرتبطة بالدخول الموحد (داخل أي إطار في البوابة) تطلب رمز الدخول، فيُرسل لنطاقها فقط
  const SSO = new Set(["https://najran-safety-cards.netlify.app", "https://najran-dispatch-board.netlify.app", "https://wabran-licenses-platform.netlify.app", "https://najran-wabran-dor-dashboard.netlify.app", "https://work-orders-control-center.netlify.app"]);
  window.addEventListener("message", (e) => {
    if (!SSO.has(e.origin) || !e.data || e.data.type !== "wabran-ready" || !e.source || !HUB.Auth.token) return;
    const fromFrame = [...document.querySelectorAll("iframe")].some((f) => f.contentWindow === e.source);
    if (fromFrame) e.source.postMessage({ type: "wabran-token", token: HUB.Auth.token }, e.origin);
  });
  function frame(url, label) {
    const rp = REGISTRY.find((x) => x.url === url);
    if (rp && rp.ownStorage) return OWN_MSG(rp);
    if (rp && rp.noFrame) return `<div class="panel empty"><h3>${esc(rp.name)} تمنع العرض داخل منصة أخرى</h3><p>المنصة الأصلية مضبوطة لمنع عرضها داخل المواقع الأخرى، فتُفتح في تبويب مستقل.</p><a class="btn pri" href="${esc(url)}" target="_blank" rel="noopener">فتح المنصة الأصلية</a></div>`;
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
  const expBar = (desc, n, attr) => !canExpP(parse().app) ? `<div class="exp-bar"><span class="hint" style="margin:0">${esc(desc)} — <b>${U.fmt(n)}</b> سجل</span><span class="hint" style="margin:0">التصدير غير متاح لصلاحيتك (عرض فقط)</span></div>` : `<div class="exp-bar"><span class="hint" style="margin:0">${esc(desc)} — <b>${U.fmt(n)}</b> سجل</span><span class="exp-btns"><button class="btn pri sm" type="button" ${attr}="xlsx">تصدير Excel</button><button class="btn sm" type="button" ${attr}="csv">تصدير CSV</button><button class="btn sm" type="button" ${attr}="print">طباعة / PDF</button></span></div>`;

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

  /* خطة التحصيل (من ورقة «خطة تحصيل محتملة» في تقرير المشاريع الكبيرة) — نفس تحليل المنصة الأصلية */
  function bpCollections(ds) {
    const C = ds.collections;
    if (!C || !C.stages || !C.stages.length) return `<div class="note">خطة التحصيل تظهر بعد تحديث البيانات من آخر تقرير مرفوع في المنصة الأصلية.</div>`;
    const col = (l) => (/رابعة|موازنة/.test(l) ? "#F59E0B" : /ثالثة|ثانثة|اصدار|إصدار/.test(l) ? "#0F2537" : "#10B981");
    const mil = (v) => (v / 1e6).toFixed(2);
    const st = C.stages;
    const cards = st.map((x) => `<div class="pk" style="--c:${col(x.label)}"><span class="pk-t">${esc(x.label)}</span><b class="pk-v">${mil(x.total)}<small>مليون</small></b><span class="pk-s">ر.س · ${x.count} مشروع</span></div>`).join("");
    // أعمدة المقارنة
    const W = 640, H = 330, L = 64, R = 12, T = 30, B = 70, mx = Math.max(1, ...st.map((x) => x.total)) * 1.12, bw = (W - L - R) / st.length;
    const y = (v) => T + (H - T - B) * (1 - v / mx);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => (mx / 1.12) * f).map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 3"/><text x="${L - 8}" y="${y(v) + 4}" font-size="13" text-anchor="end" fill="currentColor" fill-opacity=".6">${v ? Math.round(v / 1e6) + " م" : 0}</text>`).join("");
    const two = (l) => { const w = l.replace(/[()]/g, "").split(" ").filter(Boolean); const a = w.slice(0, 2).join(" "), b = w.slice(2).join(" "); return [a, b.length > 15 ? b.slice(0, 14) + "…" : b]; };
    const bars = st.map((x, i) => { const k = st.length - 1 - i, bx = L + k * bw + bw * 0.14, w = bw * 0.72, cx = bx + w / 2, [l1, l2] = two(x.label);
      return `<g><title>${esc(x.label)}: ${U.fmt(Math.round(x.total))} ر.س · ${x.count} مشروع</title><rect x="${bx}" y="${y(x.total)}" width="${w}" height="${Math.max(0, H - B - y(x.total))}" rx="4" fill="${col(x.label)}"/>` +
        `<text x="${cx}" y="${y(x.total) - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${mil(x.total)}</text>` +
        `<text x="${cx}" y="${H - B + 22}" text-anchor="middle" font-size="12.5" font-weight="600" fill="currentColor">${esc(l1)}</text><text x="${cx}" y="${H - B + 40}" text-anchor="middle" font-size="11.5" fill="currentColor" fill-opacity=".7">${esc(l2)}</text></g>`; }).join("");
    const chart = `<svg viewBox="0 0 ${W} ${H}" class="sch-svg" role="img" aria-label="مقارنة قيم مراحل التحصيل (مليون ريال)">${grid}${bars}</svg><p class="hint" style="margin-top:4px">القيم بالمليون ريال، والمراحل من اليمين: الأولى ثم التالية.</p>`;
    // توزيع القيم (حلقة)
    const tot = st.reduce((t, x) => t + x.total, 0) || 1; let a0 = -Math.PI / 2;
    const arcs = st.map((x) => { const a1 = a0 + (x.total / tot) * Math.PI * 2, r = 80, r2 = 50, cx = 100, cy = 100;
      const p = (a, rr) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`, big = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M${p(a0, r)} A${r} ${r} 0 ${big} 1 ${p(a1, r)} L${p(a1, r2)} A${r2} ${r2} 0 ${big} 0 ${p(a0, r2)}Z`; a0 = a1;
      return `<path d="${d}" fill="${col(x.label)}" stroke="var(--panel,#fff)" stroke-width="2"><title>${esc(x.label)}: ${((x.total / tot) * 100).toFixed(1)}%</title></path>`; }).join("");
    const donut = `<div class="bp-donut"><svg viewBox="0 0 200 200" role="img" aria-label="توزيع قيم مراحل التحصيل">${arcs}<text x="100" y="96" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">${mil(tot)}</text><text x="100" y="118" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity=".65">مليون ر.س</text></svg>
      <ul>${st.map((x) => `<li><i style="background:${col(x.label)}"></i>${esc(x.label)}<b>${((x.total / tot) * 100).toFixed(1)}%</b></li>`).join("")}</ul></div>`;
    const tbl = `<div class="tbl"><table><thead><tr><th>رقم أمر العمل</th><th>اسم المشروع</th>${st.map((x) => `<th>${esc(x.label)}</th>`).join("")}<th>موقف وملاحظات</th><th>موقف GIS</th></tr></thead><tbody>
      ${C.rows.map((r) => `<tr><td class="num">${esc(r.wo)}</td><td>${esc(r.name)}</td>${st.map((x) => `<td class="num">${r.stages[x.col] ? U.fmt(Math.round(r.stages[x.col])) : ""}</td>`).join("")}<td>${esc(r.note)}</td><td>${esc(r.gis)}</td></tr>`).join("")}
      <tr class="tot"><td colspan="2"><b>الإجمالي</b></td>${st.map((x) => `<td class="num"><b>${U.fmt(Math.round(x.total))}</b></td>`).join("")}<td colspan="2"></td></tr></tbody></table></div>`;
    return `<section class="section"><div class="pk-head"><h2>خطة التحصيل</h2><span>${esc(C.title)} · إجمالي ${U.fmt(Math.round(C.total))} ر.س</span></div>
      <div class="pk-grid bp5">${cards}</div>
      <div class="section two"><div class="panel"><h3>مقارنة قيم مراحل التحصيل</h3>${chart}</div><div class="panel"><h3>توزيع القيم حسب المرحلة</h3>${donut}</div></div>
      <section class="section"><h3>مشاريع خطة التحصيل (${C.rows.length})</h3>${tbl}</section></section>`;
  }

  /* المؤشرات الرئيسية لمنصة المشاريع الكبيرة — نفس بطاقات المنصة الأصلية ومعادلاتها */
  function bpKpis(A, ds) {
    const rows = A.rows, has = (f) => rows.filter((r) => r[f] != null && r[f] !== ""), sum = (f) => rows.reduce((t, r) => t + (Number(r[f]) || 0), 0);
    const mil = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}<small>مليون</small>` : `${U.fmt(Math.round(v))}<small>ر.س</small>`);
    const est = sum("estCost"), act = sum("actCost");
    const partialN = rows.filter((r) => Number(r.partial) > 0).length, finalN = rows.filter((r) => Number(r.final) > 0).length, finalSt = rows.filter((r) => /نهائي/.test(r.payStatus || "")).length;
    const paidRows = has("paid").length ? has("paid") : rows.filter((r) => Number(r.partial) > 0 || Number(r.final) > 0);
    const paid = paidRows.reduce((t, r) => t + (Number(r.paid != null ? r.paid : (Number(r.partial) || 0) + (Number(r.final) || 0)) || 0), 0);
    const remaining = rows.filter((r) => { const x = String(r.remaining || "").trim(); return x && !/^(منتهي|تم الانتهاء( بالكامل)?)$/.test(x); }).length;
    const over = rows.filter((r) => Number(r.pct) > 100).length;
    const up = ds.uploadedAt ? new Date(ds.uploadedAt) : null;
    const card = (col, t, v, s, link) => `<div class="pk" style="--c:${col}"${link ? ` role="link" tabindex="0" data-go="${link}"` : ""}><span class="pk-t">${t}</span><b class="pk-v">${v}</b><span class="pk-s">${s}</span></div>`;
    const go = (st) => `#/app/bigprojects/all`;
    return `<section class="section"><div class="pk-head"><h2>المؤشرات الرئيسية</h2><span>من آخر تقرير مرفوع في منصة المشاريع الكبيرة${ds.title ? ": " + esc(ds.title.replace(/\s+/g, " ")) : ""}.</span></div>
      <div class="pk-grid four bp">
        ${card("#0F2537", "إجمالي عدد المشاريع", U.fmt(rows.length), "مشاريع أكبر من 100 ألف")}
        ${card("#0EA5E9", "إجمالي الأجور طبقاً للفواتير", mil(sum("invoice")), `ر.س · ${has("invoice").length} مشروعاً لها قيمة`)}
        ${card("#0F2537", "تكلفة العمالة التقديرية", mil(est), `ر.س · ${has("estCost").length} مشروعاً`)}
        ${card("#0EA5E9", "تكلفة العمالة حسب المنفذ", mil(act), `ر.س · ${has("actCost").length} مشروعاً`)}
        ${card("#10B981", "نسبة التنفيذ المالية الإجمالية", (est ? ((act / est) * 100).toFixed(1) : "—") + "%", "إجمالي المنفذ ÷ إجمالي التقديري")}
        ${card("#10B981", "إجمالي الصرف الجزئي", mil(sum("partial")), `ر.س · ${partialN} مشروعاً بمبالغ`)}
        ${card("#10B981", "إجمالي الصرف النهائي المسجل", mil(sum("final")), `ر.س · ${finalN} مشروعاً بمبالغ (${finalSt} بموقف صرف نهائي)`)}
        ${card("#0F2537", "إجمالي الصرف (جزئي + نهائي)", mil(paid), `ر.س · ${paidRows.length} مشروعاً`)}
        ${card("#F59E0B", "مشاريع لديها أعمال متبقية", U.fmt(remaining), "اضغط للفلترة في التقارير", go())}
        ${card("#8B5CF6", "نسبة تنفيذ أكبر من 100%", U.fmt(over), "اضغط للفلترة في التقارير", go())}
        ${card("#64748B", "تاريخ آخر تحديث", U.longDate(new Date(ds.asof)), up ? "رُفع " + up.toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }) : "")}
      </div></section>`;
  }

  /* المؤشرات الرئيسية لمنصة مستهدف الإنشاءات — بنفس تصميم المنصة الأصلية */
  function projKpis(A) {
    const rows = A.live, tot = rows.reduce((t, r) => t + (Number(r.amount) || 0), 0);
    const wos = new Set(rows.map((r) => r.wo)).size;
    const STG = [
      ["delivery", "تم التسليم للمقاول (لم يُستلم)", "#7C8794", (r) => r.delivered],
      ["receipt", "تم الاستلام (لم تصدر الشهادة)", "#D9821E", (r) => r.received || r.delivered],
      ["drawing", "مؤكد ولم يدخل مستخلصاً (الرسم)", "#2F6DB5", (r) => r.cert || r.received || r.delivered],
      ["invoice", "دخل مستخلصاً ولم يُصرف", "#1E8E4E", (r) => r.abstractDate || r.cert || r.received || r.delivered],
    ];
    const med = (a) => { if (!a.length) return null; a.sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };
    const mil = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + " مليون" : v >= 1e3 ? Math.round(v / 1e3) + " ألف" : money(v));
    const pc = (v) => (tot ? ((v / tot) * 100).toFixed(1) : "0") + "%";
    const st = STG.map(([id, label, col, dt]) => {
      const x = rows.filter((r) => r.cls === id), amt = x.reduce((t, r) => t + (Number(r.amount) || 0), 0);
      const ages = x.map((r) => U.daysFrom(dt(r))).filter((d) => d != null && d >= 0);
      return { id, label, col, n: x.length, amt, med: med(ages) };
    });
    const inv = st.find((x) => x.id === "invoice"), invPct = tot ? (inv.amt / tot) * 100 : 0;
    const card = (col, title, val, unit, sub, bar, cls = "") => `<div class="pk ${cls}" style="--c:${col}"><span class="pk-t">${title}</span><b class="pk-v">${val}${unit ? `<small>${unit}</small>` : ""}</b><span class="pk-s">${sub}</span>${bar != null ? `<i class="pk-bar"><i style="width:${Math.min(100, Math.max(0, bar)).toFixed(1)}%"></i></i>` : ""}</div>`;
    return `<section class="section"><div class="pk-head"><h2>المؤشرات الرئيسية</h2><span>الحجم الفعلي لأوامر العمل في ملف نجران، كل بطاقة تفتح البنود التي بُنيت عليها.</span></div>
      <div class="pk-grid three">
        ${card("#8E2A2A", "أوامر العمل (أرقام فريدة)", U.fmt(wos), "", `${U.fmt(rows.length)} بنداً (أمر × رمز نوع) في ${st.filter((x) => x.n).length} مراحل`, null, "big")}
        ${card("#B8860B", "إجمالي القيمة المسجلة (ريال)", (tot / 1e6).toFixed(2), "مليون", `${money(Math.round(tot))} ريال · مجموع الأعمدة المالية في الملف`, null, "big")}
        ${card("#1E8E4E", "نسبة القيمة التي دخلت المستخلص", invPct.toFixed(1) + "%", "", `${(inv.amt / 1e6).toFixed(2)} مليون من ${(tot / 1e6).toFixed(2)} مليون ريال — مؤشر مالي لمسار الإقفال، وليس نسبة إنجاز الأعمال`, invPct, "big")}
      </div>
      <div class="pk-grid four">
        ${st.map((x) => `<a class="pk-link" href="#/app/projects/all" data-pkcls="${x.id}">${card(x.col, x.label, U.fmt(x.n), "", `${mil(x.amt)} ريال · ${pc(x.amt)} من القيمة${x.med != null ? " · وسيط البقاء " + U.fmt(x.med) + " يوماً" : ""}`, tot ? (x.amt / tot) * 100 : 0)}</a>`).join("")}
      </div></section>`;
  }

  /* ---------- جدول الأعمال: «التحليل الشهري» بنفس حساب المنصة الأصلية ---------- */
  function schedModel(ds) {
    if (ds.monthly && ds.monthly.months && ds.monthly.months.length) return ds.monthly;
    // احتياط عند غياب النسخة المحسوبة: نفس معادلات المنصة (المخطط اليومي = متوسط كل أيام التقارير)
    const byDay = new Map(); (ds.rows || []).forEach((r) => { if (r.date) byDay.set(r.date, (byDay.get(r.date) || 0) + (Number(r.value) || 0)); });
    const days = [...byDay].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value }));
    const avgDaily = days.length ? days.reduce((t, d) => t + d.value, 0) / days.length : null;
    const st = (a, pl) => (a == null || !pl ? "none" : a / pl >= 0.95 ? "ok" : a / pl >= 0.8 ? "warn" : "bad");
    const mm = new Map(); days.forEach((d) => { const k = d.date.slice(0, 7); if (!mm.has(k)) mm.set(k, []); mm.get(k).push(d); });
    const months = [...mm].map(([ym, ds2]) => {
      const value = ds2.reduce((t, d) => t + d.value, 0), n = ds2.length, dim = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
      const have = new Set(ds2.map((d) => d.date)), last = days[days.length - 1].date, missing = [];
      for (let i = 1; i <= dim; i++) { const d = ym + "-" + String(i).padStart(2, "0"); if (d > last) break; if (!have.has(d)) missing.push(d); }
      return { ym, value, days: n, avg: value / n, count: null, planAvg: avgDaily, plan: avgDaily * n, status: st(value, avgDaily * n), avgStatus: st(value / n, avgDaily), bad: ds2.filter((d) => st(d.value, avgDaily) === "bad").length, missing, target: null, daily: ds2.map((d) => ({ ...d, plan: avgDaily, status: st(d.value, avgDaily) })), byLoc: [], byItem: [] };
    });
    return { lastDate: days.length ? days[days.length - 1].date : null, avgDaily, mode: "avg", months, approx: true };
  }
  const SHC = { ok: "#2E7D4F", warn: "#B8862B", bad: "#9C3328", none: "#8A979C" };
  const SHT = { ok: "✓ على المسار", warn: "▲ يحتاج متابعة", bad: "✗ متأخر / حرج", none: "○ غير متاح" };
  function svgMonthBars(ms, sel) {
    const W = 640, H = 270, L = 8, R = 58, T = 14, B = 30, mx = Math.max(1, ...ms.map((m) => Math.max(m.value, m.plan || 0))) * 1.08;
    const bw = (W - L - R) / ms.length, y = (v) => T + (H - T - B) * (1 - v / mx);
    const tick = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : String(Math.round(v)));
    const grid = [0, 0.5, 1].map((f) => mx / 1.08 * f).map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".12"/><text x="${W - R + 6}" y="${y(v) + 4}" font-size="11" fill="currentColor" fill-opacity=".6">${tick(v)}</text>`).join("");
    const bars = ms.map((m, i) => { const x = L + i * bw + bw * 0.14, w = bw * 0.72, c = m.ym === sel ? "#C8922A" : SHC[m.avgStatus] || SHC.none;
      return `<g data-schm="${m.ym}" style="cursor:pointer"><title>${m.ym}: منفذ ${U.fmt(Math.round(m.value))} · مخطط ${U.fmt(Math.round(m.plan || 0))}</title><rect x="${x}" y="${y(m.value)}" width="${w}" height="${Math.max(0, H - B - y(m.value))}" rx="2" fill="${c}"${m.ym === sel ? ' stroke="#13262F" stroke-width="1.5"' : ""}/><text x="${x + w / 2}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity=".75">${m.ym.slice(2)}</text></g>`; }).join("");
    const pl = ms.map((m, i) => `${L + i * bw + bw / 2},${y(m.plan || 0)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" class="sch-svg" role="img" aria-label="المخطط مقابل المنفذ شهرياً" direction="ltr">${grid}${bars}<polyline points="${pl}" fill="none" stroke="#C8922A" stroke-width="2" stroke-dasharray="5,4"/></svg>`;
  }
  function svgTrend(ms) {
    const W = 640, H = 270, L = 22, R = 52, T = 14, B = 30, mx = Math.max(1, ...ms.map((m) => Math.max(m.avg || 0, m.planAvg || 0))) * 1.12;
    const x = (i) => L + (ms.length < 2 ? (W - L - R) / 2 : (i * (W - L - R)) / (ms.length - 1)), y = (v) => T + (H - T - B) * (1 - v / mx);
    const tick = (v) => (v >= 1e3 ? Math.round(v / 1e3) + "K" : String(Math.round(v)));
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => (mx / 1.12) * f).map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".1"/><text x="${W - R + 6}" y="${y(v) + 4}" font-size="11" fill="currentColor" fill-opacity=".6">${tick(v)}</text>`).join("");
    const lab = ms.map((m, i) => (ms.length <= 8 || (ms.length - 1 - i) % 2 === 0 ? `<text x="${x(i)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity=".75">${m.ym.slice(2)}</text>` : "")).join("");
    const pts = ms.map((m, i) => `${x(i)},${y(m.avg || 0)}`).join(" "), plan = ms.map((m, i) => `${x(i)},${y(m.planAvg || 0)}`).join(" ");
    const dots = ms.map((m, i) => `<circle cx="${x(i)}" cy="${y(m.avg || 0)}" r="3.2" fill="#C8922A"><title>${m.ym}: ${U.fmt(Math.round(m.avg || 0))} ريال/يوم</title></circle>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="sch-svg" role="img" aria-label="اتجاه الإنجاز الشهري" direction="ltr">${grid}${lab}<polyline points="${plan}" fill="none" stroke="#3D5A73" stroke-width="2" stroke-dasharray="6,5"/><polyline points="${pts}" fill="none" stroke="#C8922A" stroke-width="2.6"/>${dots}</svg>`;
  }
  function schedMonthly(ds) {
    const M = schedModel(ds), ms = M.months;
    if (!ms.length) return `<div class="panel empty"><h3>لا بيانات</h3></div>`;
    let ym = ui.schM && ms.some((m) => m.ym === ui.schM) ? ui.schM : ms[ms.length - 1].ym; ui.schM = ym;
    const i = ms.findIndex((m) => m.ym === ym), m = ms[i], pm = ms[i - 1];
    const chg = (a, b) => (b == null || !b ? "" : `${a >= b ? "▲" : "▼"} ${Math.abs(((a - b) / b) * 100).toFixed(1)}% عن الشهر السابق`);
    const SAR = (v) => U.fmt(Math.round(v || 0)) + " <small>SAR</small>";
    const sg = (v) => (v >= 0 ? "+" : "−") + U.fmt(Math.abs(Math.round(v)));
    const tile = (l, v, d, st, stt) => `<div class="sch-k"><span class="l">${l}</span><b class="v">${v}</b><span class="d">${d || "&nbsp;"}</span><span class="s" style="color:${SHC[st]}">${stt || SHT[st]}</span></div>`;
    const pct = m.plan ? (m.value / m.plan) * 100 : null;
    const miss = m.missing || [];
    const tiles = [
      tile("المخطط الشهري (افتراضي)", SAR(m.plan), m.target ? "هدف محدد يدوياً: " + U.fmt(m.target) : "متوسط × أيام التقارير", "none", "○ افتراض معتمد"),
      tile("المنفذ الشهري", SAR(m.value), pm ? chg(m.value, pm.value) : "لا شهر سابق", m.status),
      tile("نسبة الإنجاز الشهري", pct == null ? "—" : (+pct.toFixed(1)) + "%", "منفذ ÷ مخطط", m.status),
      tile("انحراف الشهر", sg(m.value - (m.plan || 0)) + " <small>SAR</small>", "المنفذ − المخطط", m.status),
      tile("الإنتاجية اليومية", U.fmt(Math.round(m.avg || 0)) + " <small>SAR/يوم</small>", pm ? chg(m.avg, pm.avg) : "", m.avgStatus),
      tile("أيام متأخرة", U.fmt(m.bad), `من ${m.days} يوم · أقل من 80% من المخطط اليومي`, m.bad ? "bad" : "ok", m.bad ? SHT.bad : "✓ لا أيام متأخرة"),
      tile("أيام بلا تقرير", U.fmt(miss.length), miss.slice(0, 4).map((d) => U.dmy(d)).join("، ") + (miss.length > 4 ? "…" : ""), miss.length ? "warn" : "ok", miss.length ? SHT.warn : "✓ كل الأيام مسجلة"),
      tile("المتبقي لهدف الشهر", m.target ? SAR(Math.max(0, m.target - m.value)) : "غير متاح", m.target ? "هدف " + U.fmt(m.target) : "حدد هدفاً في «التخطيط والتحكم» بالمنصة الأصلية", "none", m.target ? "○ من الهدف اليدوي" : "○ غير متاح"),
    ];
    const dmx = Math.max(1, ...(m.daily || []).map((d) => d.value));
    const dayBars = (m.daily || []).map((d) => ({ l: U.dmy(d.date), v: Math.round(d.value), c: SHC[d.status] || SHC.none }));
    const locs = (m.byLoc || []).map(([l, v]) => ({ l, v: Math.round(v), c: "var(--ink)" }));
    return `<section class="section sch">
      <div class="sch-top"><div><h2>التحليل الشهري</h2><p class="hint">نفس أرقام صفحة «التحليل الشهري» في المنصة الأصلية${M.approx ? " (محسوبة تقريبياً من صفوف البوابة لحين المزامنة من المنصة)" : ""}.</p></div>
        <div class="sch-nav"><button class="btn sm" type="button" data-schm="${pm ? pm.ym : ""}" ${pm ? "" : "disabled"}>→ الشهر السابق</button>
        <select id="schSel" aria-label="اختيار الشهر">${ms.map((x) => `<option value="${x.ym}"${x.ym === ym ? " selected" : ""}>${x.ym}</option>`).join("")}</select>
        <button class="btn sm" type="button" data-schm="${ms[i + 1] ? ms[i + 1].ym : ""}" ${ms[i + 1] ? "" : "disabled"}>الشهر التالي ←</button></div>
        <span class="sch-meta">آخر بيانات: <b>${M.lastDate ? U.dmy(M.lastDate) : "—"}</b>${ds.items ? ` · ${U.fmt(ds.items)} بند` : ""}${ds.syncedAt ? ` · مزامنة ${new Date(ds.syncedAt).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}` : ""}</span></div>
      <div class="sch-grid">${tiles.join("")}</div>
      <div class="section two">
        <div class="panel"><h3>المخطط مقابل المنفذ شهرياً</h3><p class="hint">اضغط عموداً لاختيار الشهر. الخط المتقطع = المخطط. اللون حسب الإنتاجية مقابل المخطط.</p>${svgMonthBars(ms, ym)}</div>
        <div class="panel"><h3>اتجاه الإنجاز الشهري (متوسط يومي)</h3><p class="hint"><span class="lg" style="--c:#C8922A"></span> متوسط يومي &nbsp; <span class="lg dash" style="--c:#3D5A73"></span> المخطط (افتراضي) · ريال/يوم</p>${svgTrend(ms)}</div>
      </div>
      <div class="section two">
        <div class="panel"><h3>الإنتاجية اليومية داخل الشهر ${ym}</h3><p class="hint">قيمة المنفذ في كل يوم مسجل، ملونة مقابل المخطط اليومي.</p>${dayBars.length ? barList(dayBars.slice().reverse(), dmx, money) : `<div class="empty">لا أيام مسجلة.</div>`}</div>
        <div class="panel"><h3>توزيع الأعمال حسب الموقع</h3><p class="hint">${ym} · الأعلى قيمة أولاً.</p>${locs.length ? barList(locs, Math.max(1, ...locs.map((x) => x.v)), money) : `<div class="empty">يظهر بعد المزامنة من المنصة الأصلية.</div>`}</div>
      </div></section>`;
  }

  /* ---------- إضافة أوامر عمل لمنصة الإسناد: Excel / PDF / صورة / لصق → مراجعة → ملف استيراد ---------- */
  const WOF = [
    ["wo_number", "رقم أمر العمل", "id", ["رقم امر العمل", "امر العمل", "أمر العمل"]], ["contract_number", "رقم العقد", "id", ["العقد"]], ["work_type_code", "رمز نوع أمر العمل", "id", ["رمز نوع امر العمل", "رمز النوع"]],
    ["work_type_name", "نوع امر العمل", "text", ["نوع أمر العمل", "نوع العمل"]], ["wo_status", "موقف أمر العمل", "text", ["حالة أمر العمل", "موقف الامر"]], ["payment_status", "حالة الصرف", "text", ["الصرف"]],
    ["contractor_number", "رقم المقاول", "id", []], ["contractor_name", "المقاول", "text", ["اسم المقاول"]], ["office_code", "رمز المكتب", "id", []], ["office_name", "المكتب", "text", ["اسم المكتب"]],
    ["approved_value", "قيمة أمر العمل المعتمدة", "money", ["القيمة المعتمدة", "قيمة أمر العمل"]], ["estimated_budget", "الميزانية التقديرية", "money", []], ["labor_cost", "تكلفة العمالة", "money", []],
    ["issued_material_cost", "تكلفة المواد المصروفه", "money", ["تكلفة المواد المصروفة"]], ["unissued_material_cost", "تكلفة المواد الغير مصروفه", "money", ["تكلفة المواد غير المصروفة"]], ["total_actual_cost", "التكلفة الفعلية الإجمالية", "money", []],
    ["certificate_amount", "مبلغ شهادة الإنجاز", "money", ["مبلغ شهادة الانجاز"]], ["actual_paid_amount", "المبلغ المصروف فعلياً", "money", []],
    ["delivered_date", "تاريخ التسليم للمقاول", "date", ["تاريخ التسليم"]], ["received_date", "تاريخ الاستلام من المقاول", "date", ["تاريخ الاستلام"]], ["cert_date", "تاريخ شهادة الانجاز", "date", []],
    ["cert_approval_date", "تاريخ اعتماد شهادة الانجاز", "date", []], ["contractor_cert_approval_date", "تاريخ اعتماد المقاول لشهادة الانجاز", "date", []],
    ["extract_number", "رقم المستخلص", "id", []], ["extract_date", "تاريخ المستخلص", "date", []], ["planned_completion_date", "تاريخ الإنجاز المخطط", "date", []],
    ["actual_completion_date", "تاريخ الإنجاز الفعلي", "date", []], ["expected_payment_date", "تاريخ الصرف المتوقع", "date", []], ["actual_payment_date", "تاريخ الصرف الفعلي", "date", []],
    ["management_notes", "ملاحظات الإدارة", "text", []], ["risk_level", "مستوى المخاطر", "text", []], ["follow_up_owner", "المسؤول عن المتابعة", "text", []],
  ];
  const WO_ST = ["تم تسليم المقاول ولم يتم الاستلام", "تم الاستلام من المقاول ولم تصدر شهادة الانجاز", "صدرت شهادة الانجاز ولم تعتمد", "معتمد ولم تأكد من المقاول", "مؤكد ولم تدخل مستخلص", "دخلت مستخلص ولم تصرف", "منتهي"];
  const WO_PAY = ["تم الصرف", "لم تصرف"];
  const WO_IMPORT = "https://work-orders-control-center.netlify.app/import";
  const woNorm = (t) => String(t ?? "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
  const WO_HEAD = new Map(); WOF.forEach(([k, l, , al]) => [l, ...al].forEach((x) => WO_HEAD.set(woNorm(x), k)));
  function woVal(type, v) {
    if (v == null || v === "") return null;
    if (type === "money") { const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s٬]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))); return isNaN(n) ? null : n; }
    if (type === "date") {
      if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      const s = String(v).trim(); let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return s;
    }
    return String(v).trim();
  }
  function woFromTable(aoa) {
    // أول صف فيه 3 عناوين معروفة على الأقل = صف العناوين
    let h = -1, map = null;
    for (let i = 0; i < Math.min(aoa.length, 15); i++) { const m = (aoa[i] || []).map((c) => WO_HEAD.get(woNorm(c)) || null); if (m.filter(Boolean).length >= 3) { h = i; map = m; break; } }
    if (h < 0) return null;
    const T = Object.fromEntries(WOF.map((f) => [f[0], f[2]]));
    return aoa.slice(h + 1).filter((r) => r && r.some((c) => c !== null && c !== "")).map((r) => { const o = {}; map.forEach((k, i) => { if (k && o[k] == null) o[k] = woVal(T[k], r[i]); }); return o; }).filter((o) => o.wo_number || o.contract_number);
  }
  function woIssues(r) {
    const out = [];
    ["wo_number", "contract_number", "work_type_code"].forEach((k) => { if (!r[k]) out.push(WOF.find((f) => f[0] === k)[1] + " مطلوب"); });
    if (r.wo_status && !WO_ST.includes(r.wo_status)) out.push("موقف غير معروف");
    if (r.payment_status && !WO_PAY.includes(r.payment_status)) out.push("حالة صرف غير معروفة");
    return out;
  }
  function woAddView() {
    const rows = ui.woRows || [], bad = rows.filter((r) => woIssues(r).length).length;
    const keys = new Map(); rows.forEach((r) => { const k = [r.wo_number, r.contract_number, r.work_type_code].join("|"); keys.set(k, (keys.get(k) || 0) + 1); });
    const dup = [...keys.values()].filter((n) => n > 1).length;
    const show = ["wo_number", "contract_number", "work_type_code", "work_type_name", "contractor_name", "office_name", "approved_value", "delivered_date", "wo_status", "payment_status"];
    return `<section class="section panel"><h3>إضافة أوامر عمل لمنصة الإسناد</h3>
      <p class="hint">أرفق ملف Excel أو CSV أو PDF أو صورة، أو الصق الجدول/النص. تُستخرج أوامر العمل وتراجعها هنا، ثم يُنزَّل ملف استيراد بنفس أعمدة المنصة فتستورده من «مركز الاستيراد» فيها (إضافة أو تحديث). المفتاح: رقم أمر العمل + رقم العقد + رمز النوع.</p>
      <div class="wo-in">
        <label class="wo-drop" for="woFile"><b>اختر ملفاً</b><span>Excel · CSV · PDF · صورة (حتى 4 ميجابايت)</span><input id="woFile" type="file" accept=".xlsx,.xlsm,.xls,.csv,.pdf,image/png,image/jpeg,image/webp" multiple></label>
        <div class="wo-paste"><textarea id="woPaste" rows="5" placeholder="أو الصق هنا جدولاً منسوخاً من Excel (مع صف العناوين) أو نص رسالة/مستند فيه أوامر عمل"></textarea>
          <button class="btn pri" type="button" data-wo="paste">استخراج من النص</button></div>
      </div>
      <p class="msg" id="woMsg" role="status">${esc(ui.woMsg || "")}</p></section>
      ${rows.length ? `<section class="section panel"><div class="wo-bar"><h3>المراجعة: ${rows.length} صف${bad ? ` · <span class="pill p-bad">${bad} ناقص</span>` : ""}${dup ? ` · <span class="pill p-warn">${dup} مفتاح مكرر</span>` : ""}</h3>
        <div class="acts"><select id="woMode" aria-label="طريقة الاستيراد"><option value="upsert">إضافة الجديد وتحديث الموجود</option><option value="append">إضافة الجديد فقط</option><option value="update">تحديث الموجود فقط</option></select>
          <button class="btn pri" type="button" data-wo="direct">استيراد مباشرة للمنصة</button><button class="btn" type="button" data-wo="xlsx">تنزيل ملف Excel</button><button class="btn" type="button" data-wo="clear">مسح</button></div></div>
        ${ui.woNotes ? `<div class="note">${esc(ui.woNotes)}</div>` : ""}
        <div class="tbl"><table class="wo-t"><thead><tr><th>#</th>${show.map((k) => `<th>${esc(WOF.find((f) => f[0] === k)[1])}</th>`).join("")}<th>ملاحظات</th><th></th></tr></thead><tbody>
        ${rows.map((r, i) => { const is = woIssues(r); return `<tr class="${is.length ? "wo-bad" : ""}"><td class="num">${i + 1}</td>${show.map((k) => `<td><input data-woi="${i}" data-wok="${k}" value="${esc(r[k] == null ? "" : r[k])}" ${k === "wo_status" ? 'list="woStL"' : k === "payment_status" ? 'list="woPayL"' : ""} aria-label="${esc(WOF.find((f) => f[0] === k)[1])}"></td>`).join("")}<td class="wo-is">${esc(is.join("، "))}</td><td><button class="btn sm" type="button" data-wo="del" data-i="${i}" aria-label="حذف الصف">حذف</button></td></tr>`; }).join("")}
        </tbody></table></div>
        <datalist id="woStL">${WO_ST.map((x) => `<option value="${esc(x)}">`).join("")}</datalist><datalist id="woPayL">${WO_PAY.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
        <p class="hint">بقية الحقول (التكاليف والتواريخ الأخرى والمستخلص) محفوظة في الملف إن وُجدت في المصدر. الصفوف الناقصة تُرفض في المنصة عند الاستيراد، فأكملها هنا أولاً.</p></section>` : ""}`;
  }
  function woSetMsg(t) { ui.woMsg = t; const m = document.getElementById("woMsg"); if (m) m.textContent = t; }
  function woAdd(rows, notes) { ui.woRows = (ui.woRows || []).concat(rows); if (notes) ui.woNotes = notes; woSetMsg(`أُضيف ${rows.length} صف للمراجعة.`); render(); }
  async function woAI(payload) {
    const r = await fetch("/api/wo-extract", { method: "POST", headers: { "content-type": "application/json", ...HUB.Auth.headers() }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error === "ai_unavailable" ? "المساعد الذكي غير متاح حالياً" : j.error || "تعذّر الاستخراج");
    return j;
  }
  const woB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(f); });
  async function woFiles(files) {
    for (const f of files) {
      try {
        const n = f.name.toLowerCase();
        if (/\.(xlsx|xlsm|xls|csv)$/.test(n)) {
          if (!window.XLSX) throw new Error("مكتبة Excel لم تُحمَّل بعد، أعد المحاولة");
          woSetMsg(`جارٍ قراءة ${f.name}…`);
          const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: false });
          let rows = [];
          wb.SheetNames.forEach((sn) => { const r = woFromTable(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null })); if (r) rows = rows.concat(r); });
          if (!rows.length) throw new Error(`لم أجد في ${f.name} صف عناوين بأسماء أعمدة المنصة (رقم أمر العمل، رقم العقد، رمز نوع أمر العمل…)`);
          woAdd(rows);
        } else if (/\.pdf$/.test(n) || /^image\//.test(f.type)) {
          if (f.size > 4 * 1024 * 1024) throw new Error(`${f.name} أكبر من 4 ميجابايت`);
          woSetMsg(`جارٍ استخراج أوامر العمل من ${f.name} بالذكاء الاصطناعي… (قد يستغرق دقيقة)`);
          const j = await woAI(/\.pdf$/.test(n) ? { kind: "pdf", data: await woB64(f) } : { kind: "image", media_type: f.type, data: await woB64(f) });
          const T = Object.fromEntries(WOF.map((x) => [x[0], x[2]]));
          const rows = (j.rows || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, T[k] ? woVal(T[k], v) : v])));
          if (!rows.length) throw new Error(`لم يُعثر على أوامر عمل في ${f.name}`);
          woAdd(rows, [j.notes, j.truncated ? "المستند طويل: قد لا تكون كل الصفوف استُخرجت، قسّمه وأعد المحاولة." : ""].filter(Boolean).join(" "));
        } else throw new Error(`نوع الملف ${f.name} غير مدعوم`);
      } catch (e) { woSetMsg(e.message); }
    }
  }
  async function woPaste() {
    const t = (document.getElementById("woPaste") || {}).value || "";
    if (!t.trim()) return woSetMsg("الصق نصاً أو جدولاً أولاً.");
    const aoa = t.split(/\r?\n/).map((l) => l.split("\t"));
    const local = aoa.some((r) => r.length > 2) ? woFromTable(aoa) : null;
    if (local && local.length) return woAdd(local);
    try { woSetMsg("جارٍ استخراج أوامر العمل من النص بالذكاء الاصطناعي…"); const j = await woAI({ kind: "text", text: t }); const T = Object.fromEntries(WOF.map((x) => [x[0], x[2]])); const rows = (j.rows || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, T[k] ? woVal(T[k], v) : v]))); if (!rows.length) throw new Error("لم يُعثر على أوامر عمل في النص"); woAdd(rows, j.notes); }
    catch (e) { woSetMsg(e.message); }
  }
  // استيراد مباشر للمنصة بحساب المستخدم نفسه فيها (نفس طريقة «مركز الاستيراد»: دفعة استيراد + import_work_orders)
  const WO_SB = "https://qcrzkqtorraegjtdpija.supabase.co";
  const WO_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcnprcXRvcnJhZWdqdGRwaWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NDM0OTQsImV4cCI6MjExMDUxOTQ5NH0.StS5c1igG5tL_vgmpsyu-u3UZO3WXsoVNJSNZ9G0Eo8"; // المفتاح العام للمنصة (منشور في واجهتها)
  async function woDirect() {
    const all = ui.woRows || [], mode = (document.getElementById("woMode") || {}).value || "upsert";
    const seen = new Set(), rows = [];
    let rejected = 0, dups = 0;
    all.forEach((r) => { if (!r.wo_number || !r.contract_number || !r.work_type_code) { rejected++; return; } const k = [r.wo_number, r.contract_number, r.work_type_code].join("|"); if (seen.has(k)) { dups++; return; } seen.add(k); rows.push(r); });
    if (!rows.length) return woSetMsg("لا توجد صفوف مكتملة (رقم أمر العمل + رقم العقد + رمز النوع) للاستيراد.");
    if (!confirm(`استيراد ${rows.length} أمر عمل إلى منصة إسناد أوامر العمل (${mode === "append" ? "إضافة الجديد فقط" : mode === "update" ? "تحديث الموجود فقط" : "إضافة وتحديث"})؟`)) return;
    try {
      woSetMsg("جارٍ فتح جلستك في منصة أوامر العمل…");
      const sr = await fetch("/api/wo-session", { headers: HUB.Auth.headers() }); const sj = await sr.json().catch(() => ({}));
      if (!sr.ok) throw new Error(sj.error || "تعذّر فتح جلسة المنصة");
      if (!sj.own) throw new Error("حسابك غير مربوط بمنصة أوامر العمل بعد: اربطه من «إدارة البوابة ← حسابي» بكلمة مرورك في المنصة، ثم أعد المحاولة.");
      const tok = sj.session.access_token, uid = sj.session.user.id;
      const H = { authorization: "Bearer " + tok, "content-type": "application/json" };
      const call = async (path, method, body, prefer) => {
        const r = await fetch(WO_SB + path, { method, headers: { ...H, apikey: WO_ANON_KEY, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
        const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.error)) || "خطأ " + r.status);
        return j;
      };
      const prof = await call(`/rest/v1/users_profiles?id=eq.${uid}&select=role,is_active`, "GET");
      const role = prof && prof[0] && prof[0].is_active ? prof[0].role : null;
      if (role !== "admin" && role !== "data_entry") throw new Error("حسابك في منصة أوامر العمل لا يملك صلاحية الاستيراد (يلزم مدير أو إدخال بيانات).");
      const T = Object.fromEntries(WOF.map((f) => [f[0], f[2]]));
      const rec = (r) => { const o = { raw_original: {} }; WOF.forEach(([k, l, t]) => { let v = r[k]; if (v === "" || v === undefined) v = null; if (v != null && t === "money") v = Number(v); if (v != null && t === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) v = null; if (v != null && t !== "money") v = String(v); o[k] = v; if (v != null) o.raw_original[l] = v; }); return o; };
      const batch = (await call("/rest/v1/import_batches", "POST", { file_name: "منصة الوبران — إضافة أوامر عمل", sheet_name: "البوابة", mode, total_rows: all.length, status: "running", header_mapping: Object.fromEntries(WOF.map(([k, l]) => [l, k])), created_by: uid }, "return=representation"))[0];
      const sum = { inserted: 0, updated: 0, unchanged: 0, skipped: 0 };
      for (let i = 0; i < rows.length; i += 400) {
        woSetMsg(`جارٍ الاستيراد… ${Math.min(i + 400, rows.length)} من ${rows.length}`);
        const g = await call("/rest/v1/rpc/import_work_orders", "POST", { p_batch: batch.id, p_mode: mode, p_rows: rows.slice(i, i + 400).map(rec) });
        ["inserted", "updated", "unchanged", "skipped"].forEach((k) => (sum[k] += (g && g[k]) || 0));
      }
      await call(`/rest/v1/import_batches?id=eq.${batch.id}`, "PATCH", { status: rejected + dups ? "completed_with_errors" : "completed", inserted: sum.inserted, updated: sum.updated, unchanged: sum.unchanged, skipped: sum.skipped, rejected, duplicates_in_file: dups, needs_review: 0, summary: { sent: rows.length, source: "wabran-hub" }, finished_at: new Date().toISOString() });
      ui.woRows = all.filter((r) => !rows.includes(r));
      woSetMsg(`اكتمل الاستيراد: ${U.fmt(sum.inserted)} إضافة، ${U.fmt(sum.updated)} تحديث، ${U.fmt(sum.unchanged)} بلا تغيير، ${U.fmt(sum.skipped)} متجاوز${rejected ? `، ${rejected} ناقص بقي للمراجعة` : ""}${dups ? `، ${dups} مكرر` : ""}. يظهر في سجل الاستيراد بالمنصة.`);
      render();
    } catch (e) { woSetMsg("تعذّر الاستيراد: " + e.message); }
  }
  function woXlsx() {
    const rows = ui.woRows || [];
    if (!window.XLSX) return woSetMsg("مكتبة Excel لم تُحمَّل بعد، أعد المحاولة");
    const aoa = [WOF.map((f) => f[1])].concat(rows.map((r) => WOF.map(([k, , t]) => (r[k] == null || r[k] === "" ? null : t === "money" ? Number(r[k]) : String(r[k])))));
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = WOF.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "أوامر العمل");
    XLSX.writeFile(wb, `work-orders-import-${U.iso(U.today())}.xlsx`);
    woSetMsg(`نُزّل ملف بـ ${rows.length} صف. افتح «مركز الاستيراد» في المنصة وارفعه (إضافة الجديد أو تحديث الموجود).`);
  }
  document.addEventListener("change", (e) => {
    if (e.target.id === "woFile" && e.target.files.length) { const fs = [...e.target.files]; e.target.value = ""; woFiles(fs); }
    const i = e.target.dataset && e.target.dataset.woi;
    if (i != null && ui.woRows && ui.woRows[i]) { const k = e.target.dataset.wok, t = (WOF.find((f) => f[0] === k) || [])[2]; ui.woRows[i][k] = woVal(t, e.target.value); render(); }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wo]"); if (!b) return;
    const a = b.dataset.wo;
    if (a === "paste") woPaste();
    else if (a === "direct") woDirect();
    else if (a === "xlsx") woXlsx();
    else if (a === "clear") { ui.woRows = []; ui.woNotes = ""; woSetMsg(""); render(); }
    else if (a === "del") { ui.woRows.splice(+b.dataset.i, 1); render(); }
  });

  function linkedApp(p, tab) {
    if (p.id === "bigprojects" && !ui.bpRefreshed) {
      ui.bpRefreshed = true; // تحديث فوري من آخر تقرير مرفوع في المنصة الأصلية
      fetch("/api/refresh?id=bigprojects", { headers: HUB.Auth.headers() }).then((r) => r.json()).then(async (j) => {
        if (j && j.changed) { const v = await Store.get("ds_bigprojects"); if (v && v.rows && v.rows.length) { S.ds.bigprojects = v; if (parse().app === "bigprojects") render(); } }
      }).catch(() => {});
    }
    const ds = S.ds[p.id];
    const A = ds ? DS.analyze(p.id, ds) : null;
    const ev = E.items.find((i) => i.id === p.id);
    tab = tab || (A ? "overview" : canEditP(p.id) ? "data" : "overview");
    if (tab === "data" && !canEditP(p.id)) tab = "overview";
    const woAddOk = p.id === "assign" && canEditP("assign");
    if (tab === "woadd" && !woAddOk) tab = "overview";
    const tabs = (woAddOk ? [["woadd", "إضافة أوامر عمل"]] : []).concat([["overview", "الصورة العامة"], ["analysis", "التحليل"]]).concat(p.id === "schedule" ? [] : [["late", "المتأخرة", A ? A.W(A.late) : null]]).concat([ ["all", "التقارير والتصدير", A ? A.W(A.rows) : null], ].concat(canEditP(p.id) ? [["data", "تحديث البيانات"]] : []).concat([["board", "المنصة الأصلية"]]));
    let body = "";
    const needData = `<div class="panel empty"><h3>لم تُرفع بيانات ${esc(p.short)} بعد</h3><p>ارفع ملف Excel أو الصق الجدول من المنصة الأصلية لتظهر هنا اللوحة التحليلية، وتدخل المنصة في تقرير الفرع والمساعد.</p><button class="btn pri" data-go="${link(p.id, "data")}" type="button">تحديث البيانات</button></div>`;
    const stale = A && U.daysFrom(ds.asof) > 3 ? `<div class="note">آخر بيانات بتاريخ ${U.dmy(ds.asof)} (منذ ${U.days(U.daysFrom(ds.asof))}). ${DS.AUTO[p.id] ? "البوابة تسحب من المنصة الأصلية تلقائياً، والمنصة نفسها لم تُحدّث منذ ذلك التاريخ." : "ارفع آخر نسخة من «تحديث البيانات»."}</div>` : "";

    if (tab === "woadd") body = woAddView();
    else if (tab === "board") body = frame(p.url, p.name);
    else if (tab === "data") body = dataTab(p, A, ds);
    else if (!A) body = needData;
    else if (tab === "overview" && p.id === "schedule") body = stale + schedMonthly(ds);
    else if (tab === "overview") {
      const s = A.s, open = A.live.length - A.done.length;
      let k;
      const lateAmt = A.sum(A.late), openAmt = A.sum(A.open);
      if (p.id === "bigprojects") { const sm = (f) => A.live.reduce((t, r) => t + (Number(r[f]) || 0), 0); k = [["عدد المشاريع", A.live.length], ["التكلفة التقديرية", big(sm("estCost"))], ["التكلفة المنفذة", big(sm("actCost"))], ["التنفيذ المالي", (A.score ?? "—") + "%", ev.level], ["الصرف الجزئي", big(sm("partial")), "ok"], ["الصرف النهائي", big(sm("final")), "ok"], ["في موازنة المواد", A.live.filter((r) => r.cls === "balancing").length, "warn"]]; }
      else if (p.id === "invoices") k = [["عدد الفواتير", U.fmt(A.W(A.live))], ["إجمالي الصافي", big(A.total)], ["المحصّل", big(A.doneAmt), "ok"], ["غير المحصّل", big(A.total - A.doneAmt), "warn"], ["نسبة التحصيل", (A.score ?? "—") + "%", ev.level], ["غير محصّلة أقدم من " + s.sla + " يوماً", A.W(A.late), "bad"]];
      else if (p.id === "schedule") { const m = A.months[A.months.length - 1], pm = A.months[A.months.length - 2], yr = A.months.filter((x) => x.key.startsWith(String(U.today().getFullYear()))).reduce((t, x) => t + x.amt, 0), dd = new Set(A.live.map((r) => r.date)).size; k = [["منفذ هذا الشهر", big(m.amt), "ok"], ["الشهر السابق", big(pm.amt)], ["منذ بداية السنة", big(yr)], ["أيام عمل آخر 30 يوماً", A.days30, ev.level], ["متوسط اليوم", big(A.total / Math.max(1, dd))], ["آخر تقرير", U.dmy(ds.asof)]]; }
      else if (p.id === "dispatch") k = [["إجمالي المهام", A.W(A.live)], ["اليوم", A.todays.length], ["منجز اليوم", A.todays.filter((r) => r.kind === "done").length, "ok"], ["نسبة الإنجاز حتى اليوم", (A.score ?? "—") + "%", ev.level], ["لم تنفذ في موعدها", A.W(A.late), "bad"]];
      else k = [["إجمالي الأوامر", U.fmt(A.W(A.live))], ["مفتوحة", U.fmt(A.W(A.open)), "warn"], ["قيمة المفتوحة", big(openAmt)], [s.slaText ? "متأخرة (" + s.sla + "+ يوم)" : "متأخرة", U.fmt(A.W(A.late)), "bad"], ["قيمة المتأخرة", big(lateAmt), "bad"], ["ضمن المدة", (A.score ?? "—") + "%", ev.level]];
      const mxC = Math.max(1, ...A.byCls.map((c) => c.n));
      const useAmt = p.id === "invoices" || p.id === "schedule";
      const mxM = Math.max(1, ...A.months.map((m) => (useAmt ? m.amt : m.n)));
      const d0 = A.dims[0];
      body = stale + (p.id === "projects" ? projKpis(A) : p.id === "bigprojects" ? bpKpis(A, ds) : kpis(k)) + `<p class="meta">${esc(ev.issue)}</p>
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
      body = stale + (p.id === "bigprojects" ? bpCollections(ds) : "") + A.dims.map((d) => `<section class="section"><h2>حسب ${esc(d.label)}</h2><div class="tbl"><table><thead><tr><th>${esc(d.label)}</th><th>الإجمالي</th><th>منجز</th><th>مفتوح</th><th>متأخر</th><th>نسبة الإنجاز</th>${A.s.amountKey ? "<th>القيمة (ريال)</th>" : ""}</tr></thead><tbody>
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
        ${auto && hasCap("sync") ? `<button class="btn pri" type="button" id="syncNow">مزامنة الآن من المنصات الأصلية</button><p class="msg" id="syncMsg" role="status"></p>` : ""}</div>
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
    if (tab === "data" && !canEditP("licenses")) tab = "overview";
    const allRows = HUB.licRows();
    // فترة التحليل: الرخص التي ينتهي تاريخها ضمن آخر N أشهر أو بعده (0 = الكل)
    const ps = ui.licPer ? new Date(U.today().getFullYear(), U.today().getMonth() - ui.licPer, U.today().getDate()) : null;
    const rows = ps ? allRows.filter((r) => U.parseISO(r.end) >= ps) : allRows;
    const hidOld = ps ? allRows.filter((r) => !r.closed && U.parseISO(r.end) < ps) : [];
    const perBar = `<div class="chips" style="align-items:center"><b style="margin-inline-end:6px">فترة التحليل:</b>${[[1, "آخر شهر"], [2, "آخر شهرين"], [3, "آخر 3 أشهر"], [0, "الكل"]].map(([n, l]) => `<button class="chip" type="button" data-licper="${n}" aria-pressed="${ui.licPer === n}">${l}</button>`).join("")}<span class="hint" style="margin:0 8px">${rows.length} من ${allRows.length} رخصة${ps ? " · من " + U.dmy(U.iso(ps)) : ""}</span></div>` + (hidOld.length ? `<div class="note">${hidOld.length} رخصة مفتوحة انتهت قبل بداية الفترة ولا تظهر في هذه الفترة: ${esc(hidOld.map((r) => r.loc + " (" + r.over + " يوماً)").join("، "))}</div>` : "");
    const open = rows.filter((r) => !r.closed);
    const over = open.filter((r) => r.over > 0).sort((a, b) => b.over - a.over);
    const age = U.daysFrom(S.licenses.asof);
    const tabs = [["overview", "التحليل"], ["list", "الرخص وأسباب التأخر", rows.length], ["eng", "حسب المهندس"]].concat(canEditP("licenses") ? [["data", "تحديث البيانات"]] : []).concat([["site", "المنصة المنشورة"]]);
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
    view.innerHTML = `<div class="app-head nj-band">${window.NJ ? NJ.scene("band") : ""}<div>${BACK}<h1>${esc(p.name)}</h1><p>${esc(p.purpose)} · التطبيق نفسه يعمل داخل البوابة وعلى رابطه المستقل، والبيانات واحدة.</p></div>
      ${openBtns(p)}</div><div id="saMount" style="margin-top:18px"></div>`;
    saInst = SafetyApp.mount($("#saMount"), { api: "/api/data", seed: S.cards, headers: () => HUB.Auth.headers(), canEdit: canEditP("safety"), canExport: canExpP("safety"), onChange: (v) => { S.cards = v; U.ls.set("cards", v); U.ls.set("ctxAt", 0); HUB.pushContext(); E = HUB.evaluateAll(); } });
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

  /* ---------- تخطيط العمل اليومي: جدول الأعمال اليومية (الكهرباء) + جدول التوزيع المنسق ---------- */
  const VCAT = { winch: "ونش", bucket: "سلة", jcb: "JCB", pickup: "بيك أب", trailer: "تريلا" };
  const DISP_LOGO = location.origin + "/img/";
  const STCOL = (c) => (c === "done" ? "p-ok" : c === "stopped" || c === "late" ? "p-bad" : /^wait_/.test(c || "") ? "p-warn" : "p-none");
  const EDC_HEAD = ["الرقم", "أمر عمل", "نوع العمل", "العمل مشاريع/انشاءات", "المقاول", "المستلم", "الجوال", "الموقع", "رابط Google Map", "الإحداثيات", "الجهد", "الاستشاري", "رقم الإشعار"];
  const edcRow = (r) => [r.seq, r.woNumber, r.workType, r.category, r.contractor, r.receiver, r.mobile, r.location, r.mapsUrl, r.coordsText, r.voltage, r.consultant, r.notificationNo];
  const dayName = (iso) => ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][U.parseISO(iso).getDay()];

  function printEdc(day) {
    const w = window.open("", "_blank"); if (!w) { alert("اسمح بالنوافذ المنبثقة للطباعة."); return; }
    const cls = "Classified as Confidential Internal by SEC - الشركة السعودية للكهرباء مصنف مقيد (داخلي)";
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جدول الأعمال اليومية ${day.date}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,Tahoma,sans-serif;color:#000;margin:0;padding:10px}.cls{text-align:center;font-size:9px;font-weight:600;color:#8b8000;margin:4px 0}.hd{display:flex;align-items:center;gap:16px;margin-bottom:8px}.hd img{height:60px}.hd div{flex:1;text-align:center}.hd b{display:block;font-size:18px}table{border-collapse:collapse;width:100%}th{background:#1f3864;color:#fff;font-size:10px;border:1px solid #000;padding:4px}td{border:1px solid #000;font-size:10px;padding:2px 4px;vertical-align:top}.ltr{direction:ltr}.sign{margin-top:14px;text-align:center;direction:ltr;font-weight:bold;font-size:11px}</style></head><body>
      <p class="cls">${cls}</p><div class="hd"><img src="${DISP_LOGO}logo-0.png" alt=""><div><b>جدول الأعمال اليومية</b><span>شركة ناصر مانع وبران و شركاءه</span><br><span>اليوم: <b style="display:inline;font-size:13px">${dayName(day.date)}</b> &nbsp; التاريخ: <b style="display:inline;font-size:13px" class="ltr">${day.date}</b>${day.version ? ` (نسخة معتمدة · إصدار ${day.version})` : ""}</span></div><img src="${DISP_LOGO}logo-1.jpeg" alt=""></div>
      <table><thead><tr>${EDC_HEAD.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${day.rows.map((r) => `<tr>${edcRow(r).map((v, i) => `<td${[1, 6, 8, 9, 12].includes(i) ? ' class="ltr"' : ""}>${esc(v ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p class="cls">${cls}</p><div class="sign">Project Manager | Eng. Ahmed Zahran</div><script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();
  }

  function planSheet(pl) {
    const nTeam = pl.sites.reduce((t, s) => t + s.team.length, 0), nVeh = pl.sites.reduce((t, s) => t + s.vehicles.length, 0);
    return `<div class="dsheet" id="dsheet" dir="rtl">
      <div class="ds-hd"><img src="${DISP_LOGO}logo-0.png" alt="شعار ناصر مانع الوبران وشركاه"><div><b>جدول توزيع العمالة والمعدات</b><span>شركة ناصر مانع الوبران وشركاه — فرع نجران</span><span>اليوم: <b>${dayName(pl.date)}</b> · التاريخ: <b class="ltr">${pl.date}</b>${pl.status === "published" ? " · معتمد" : " · مسودة"}</span></div><img src="${DISP_LOGO}logo-1.jpeg" alt="شعار السعودية للطاقة"></div>
      <div class="ds-sum">${pl.sites.length} موقع · ${nTeam} عامل · ${nVeh} معدة</div>
      <div class="ds-grid">${pl.sites.map((s, i) => `<section class="ds-site"><h4><span>${i + 1}</span>${esc(s.name)}${s.workType ? `<em>${esc(s.workType)}</em>` : ""}</h4>${s.note ? `<p class="ds-note">${esc(s.note)}</p>` : ""}
        ${s.vehicles.length ? `<table><thead><tr><th>المعدة</th><th>النوع</th><th>السائق / المشغل</th></tr></thead><tbody>${s.vehicles.map((v) => `<tr><td class="ltr">NP# ${esc(v.fleetNo)}</td><td>${esc(VCAT[v.category] || v.category)}</td><td>${esc(v.driver || "—")}${v.remark ? ` <small>(${esc(v.remark)})</small>` : ""}</td></tr>`).join("")}</tbody></table>` : ""}
        ${s.team.length ? `<table><thead><tr><th>الاسم</th><th>المهنة</th><th>الدور</th></tr></thead><tbody>${s.team.slice().sort((a, b) => (a.role === "foreman" ? -1 : 0) - (b.role === "foreman" ? -1 : 0)).map((t) => `<tr${t.role === "foreman" ? ' class="fm"' : ""}><td>${esc(t.name)}</td><td>${esc(t.profession)}</td><td>${t.role === "foreman" ? "فورمان" : "عضو فريق"}</td></tr>`).join("")}</tbody></table>` : ""}
      </section>`).join("")}</div>
      <div class="ds-sign">Project Manager | Eng. Ahmed Zahran</div></div>`;
  }

  function dispatchApp(p, tab) {
    const d = S.dispatch, days = (d && d.edc) || [], plans = (d && d.plans) || [];
    tab = tab || "sheet"; // الافتراضي: جدول التوزيع المنسق لآخر يوم
    const tabs = [["sheet", "جدول التوزيع المنسق (للطباعة)"], ["analysis", "التحليل وجدول الكهرباء اليومي", days[0] ? days[0].rows.length : null], ["board", "المنصة الأصلية"]];
    const sync = d && d.syncedAt ? `آخر مزامنة تلقائية من لوحة التوزيع: ${new Date(d.syncedAt).toLocaleString("ar-SA-u-nu-latn")}` : "";
    const none = `<div class="panel empty"><h3>لم تصل بيانات من لوحة التوزيع بعد</h3><p>لوحة التوزيع تحفظ جداولها داخل متصفح من يعدّها. أضفنا إليها مزامنة تلقائية: يكفي أن يفتح المخطط اللوحة مرة من جهازه، فتصل آخر الجداول هنا وتتحدث كل دقيقة أثناء العمل.</p><a class="btn pri" href="${esc(p.url)}" target="_blank" rel="noopener">فتح لوحة التوزيع</a></div>`;
    let body = "";
    if (tab === "board") body = frame(p.url, p.name);
    else if (tab === "sheet") {
      if (!plans.length) body = none;
      else {
        const pl = plans.find((x) => x.date === ui.dpDate) || plans[0];
        body = `<div class="panel"><div class="exp-bar" style="margin:0;padding:0;border:0"><span class="hint" style="margin:0">${esc(sync)}. يُعرض آخر يوم محدّث تلقائياً، ويمكن اختيار يوم سابق.</span>
          <span class="exp-btns"><select id="dpDate">${plans.map((x) => `<option value="${x.date}" ${x.date === pl.date ? "selected" : ""}>${dayName(x.date)} ${U.dmy(x.date)}${x.status === "published" ? " (معتمد)" : ""}</option>`).join("")}</select>
          <button class="btn pri sm" type="button" data-dsprint>طباعة / PDF</button><button class="btn sm" type="button" data-dspng>حفظ صورة PNG</button></span></div></div>` + planSheet(pl);
      }
    } else {
      if (!days.length) body = none;
      else {
        const day = days.find((x) => x.date === ui.ddDate) || days[0];
        const rows = day.rows.filter((r) => !ui.ddSt || r.status === ui.ddSt);
        const cnt = (k) => { const m = new Map(); day.rows.forEach((r) => m.set(r[k] || "غير محدد", (m.get(r[k] || "غير محدد") || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };
        const bl = (list) => { const mx = Math.max(1, ...list.map((x) => x[1])); return `<div class="bars">${list.map(([l, v]) => `<div class="bar"><span>${esc(l)}</span><span class="tr"><span class="fl" style="width:${(v / mx) * 100}%"></span></span><span class="v num">${v}</span></div>`).join("")}</div>`; };
        const st = cnt("status");
        const done = day.rows.filter((r) => r.statusCode === "done").length, stuck = day.rows.filter((r) => r.statusCode === "stopped" || r.statusCode === "late" || /^wait_/.test(r.statusCode)).length;
        const avgP = day.rows.filter((r) => r.progress != null).reduce((t, r, _, a) => t + r.progress / a.length, 0);
        const trend = days.slice().reverse();
        const mxT = Math.max(1, ...trend.map((x) => x.rows.length));
        body = `<div class="panel" style="margin-bottom:16px"><div class="exp-bar" style="margin:0;padding:0;border:0"><span class="hint" style="margin:0">${esc(sync)}</span>
            <span class="exp-btns"><select id="ddDate">${days.map((x) => `<option value="${x.date}" ${x.date === day.date ? "selected" : ""}>${dayName(x.date)} ${U.dmy(x.date)} (${x.rows.length})</option>`).join("")}</select>
            <button class="btn pri sm" type="button" data-edcprint>طباعة جدول الكهرباء</button></span></div></div>`
          + kpis([["أعمال اليوم", day.rows.length], ["مكتملة", done, "ok"], ["متوقفة / متأخرة / بانتظار", stuck, stuck ? "bad" : ""], ["متوسط الإنجاز", Math.round(avgP) + "%"], ["المواقع", new Set(day.rows.map((r) => r.location)).size]])
          + `<div class="section two"><div class="panel"><h3>حسب الحالة</h3>${bl(st)}</div><div class="panel"><h3>عدد الأعمال في الأيام المُزامنة</h3><div class="bars">${trend.map((x) => `<div class="bar"><span>${dayName(x.date)} ${U.dmy(x.date)}</span><span class="tr"><span class="fl" style="width:${(x.rows.length / mxT) * 100}%"></span></span><span class="v num">${x.rows.length}</span></div>`).join("")}</div></div></div>
          <div class="section two"><div class="panel"><h3>حسب نوع العمل</h3>${bl(cnt("workType"))}</div><div class="panel"><h3>حسب المستلم</h3>${bl(cnt("receiver"))}</div></div>
          <section class="section"><h2>جدول الأعمال اليومية — ${dayName(day.date)} ${U.dmy(day.date)}${day.version ? ` (معتمد · إصدار ${day.version})` : ""}</h2>
          <div class="panel" style="margin:10px 0"><div class="chips"><button class="chip" type="button" data-ddst="" aria-pressed="${!ui.ddSt}">الكل ${day.rows.length}</button>${st.map(([l, v]) => `<button class="chip" type="button" data-ddst="${esc(l)}" aria-pressed="${ui.ddSt === l}">${esc(l)} ${v}</button>`).join("")}</div>
          ${expBar(ui.ddSt ? "الحالة: " + ui.ddSt : "كل أعمال اليوم", rows.length, "data-ddexp")}</div>
          <div class="tbl"><table><thead><tr><th>#</th><th>أمر العمل</th><th>نوع العمل</th><th>التصنيف</th><th>المستلم</th><th>الجوال</th><th>الموقع</th><th>الجهد</th><th>الاستشاري</th><th>الحالة</th><th>الإنجاز</th><th>ملاحظات</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>${r.seq}</td><td class="ltr">${esc(r.woNumber)}</td><td>${esc(r.workType)}</td><td>${esc(r.category)}</td><td>${esc(r.receiver)}</td><td class="ltr">${esc(r.mobile)}</td><td>${r.mapsUrl ? `<a href="${esc(r.mapsUrl)}" target="_blank" rel="noopener">${esc(r.location)}</a>` : esc(r.location)}</td><td>${esc(r.voltage)}</td><td>${esc(r.consultant)}</td><td><span class="pill ${STCOL(r.statusCode)}">${esc(r.status)}</span></td><td class="num">${r.progress == null ? "—" : r.progress + "%"}</td><td class="wrap">${esc([r.notes, r.delayReason].filter(Boolean).join(" · "))}</td></tr>`).join("") || `<tr><td colspan="12" class="empty">لا أعمال بهذه الحالة.</td></tr>`}</tbody></table></div></section>`;
        ui.ddRows = rows; ui.ddDay = day;
      }
    }
    view.innerHTML = appShell(p, tabs, tab, body);
  }

  /* ---------- الإعدادات ---------- */
  function settings() {
    const u = HUB.user, isAdmin = hasCap("users");
    view.innerHTML = `<div class="app-head nj-band">${window.NJ ? NJ.scene("band") : ""}<div>${BACK}<h1>إدارة البوابة</h1><p>${isAdmin ? "الحسابات والصلاحيات لكل منصات الوبران — حساب واحد لكل المنصات." : "حسابك في منصة الوبران."}</p></div></div>
      <div class="section two"><div class="panel"><h3>حسابي</h3><p class="hint">${esc(u.name)} · <span class="ltr">${esc(u.email)}</span> · ${esc(u.roleLabel)}</p>
        <form class="form" id="cpForm"><label class="f">كلمة المرور الحالية<input type="password" id="cpCur" required dir="ltr" autocomplete="current-password"></label><label class="f">كلمة المرور الجديدة<input type="password" id="cpNew" minlength="6" required dir="ltr" autocomplete="new-password"></label><div><button class="btn pri" type="submit">تغيير كلمة المرور</button></div></form>
        <p class="msg" id="cpMsg" role="status"></p><button class="btn" type="button" data-logout>تسجيل الخروج</button>
        ${(u.access.assign || "none") !== "none" ? `<div class="wo-link"><h4>منصة إسناد أوامر العمل</h4>${u.woLinked
          ? `<p><span class="pill p-ok">مربوط بحسابك</span> تفتح المنصة داخل البوابة بحسابك (<span class="ltr">${esc(u.email)}</span>) وصلاحياتك فيها، ويعمل الاستيراد المباشر من «إضافة أوامر عمل».</p><button class="btn sm" type="button" data-wolink="off">فك الربط</button>`
          : `<p><span class="pill p-none">غير مربوط</span> يُربط تلقائياً عند دخول البوابة إن كانت كلمة مرورك هنا هي نفسها في المنصة. أو اكتب كلمة مرورك في منصة أوامر العمل لنفس البريد:</p><form class="form" id="woLinkForm"><label class="f">كلمة مرور منصة أوامر العمل<input type="password" id="woLinkPw" required dir="ltr" autocomplete="off"></label><button class="btn pri" type="submit">ربط حسابي</button></form>`}<p class="msg" id="woLinkMsg" role="status"></p></div>` : ""}</div>
        <div class="panel"><h3>منصاتي وصلاحياتي</h3><div class="tbl"><table><thead><tr><th>المنصة</th><th>الصلاحية</th></tr></thead><tbody>${REGISTRY_ALL.map((p) => `<tr><td>${esc(p.name)}</td><td>${AUTHUI.LV[lvl(p.id)]}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint" style="margin-top:10px">صلاحيات عامة: ${u.caps.map((c) => AUTHUI.CAPL[c]).join("، ") || "لا يوجد"}</p>
        <div class="chips">${["auto:تلقائي", "light:فاتح", "dark:داكن"].map((x) => { const [k, l] = x.split(":"); return `<button class="chip" type="button" data-theme="${k}" aria-pressed="${(U.ls.get("theme") || "auto") === k}">المظهر: ${l}</button>`; }).join("")}</div></div></div>
      ${isAdmin ? `<section class="section"><h2>إدارة الحسابات والصلاحيات</h2><p class="hint">أضف مستخدماً، واختر دوره (مدير مشروع، مهندس موقع، محاسب، مشاهد) أو «مخصّص»، ثم حدّد لكل منصة: بلا وصول، عرض فقط، عرض وتصدير، أو تعديل.</p><div id="usersRoot"></div></section>` : ""}`;
    if (isAdmin) AUTHUI.usersPanel($("#usersRoot"));
  }

  /* ---------- الموجّه ---------- */
  function parse() { const h = location.hash.replace(/^#\/?/, "").split("/"); if (h[0] === "app" && reg(h[1])) return { name: "app", app: h[1], tab: h[2] }; if (h[0] === "settings") return { name: "settings" }; if (h[0] === "go" && reg(h[1])) return { name: "go", app: h[1] }; return { name: "home" }; }
  function render() {
    E = HUB.evaluateAll();
    const r = parse();
    renderNav(r);
    $("#crumb").textContent = r.name === "app" || r.name === "go" ? reg(r.app).name : r.name === "settings" ? "إدارة البوابة" : "الصفحة الرئيسية";
    if (r.name !== "go") { document.body.classList.remove("go-mode"); const gb = document.getElementById("goBar"); if (gb) gb.remove(); }
    if (r.name === "go") goPage(reg(r.app));
    else if (r.name === "home") home();
    else if (r.name === "settings") settings();
    else { const p = reg(r.app); if (p.kind === "linked") linkedApp(p, r.tab); else if (p.id === "licenses") licensesApp(p, r.tab); else if (p.id === "dispatch") dispatchApp(p, r.tab); else safetyApp(p); }
    $("#side").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  }
  let lastApp = parse().app;
  window.addEventListener("hashchange", () => { const a = parse().app; if (a !== lastApp) { ui.dsF = ""; ui.dsQ = ""; ui.df = { dims: {}, state: "", from: "", to: "" }; lastApp = a; } render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- الأحداث ---------- */
  function download(name, rows) {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const blob = new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n\r\n" + q("Project Manager | Eng. Ahmed Zahran")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-wolink],[data-schm],[data-pkcls],[data-logout],[data-dsprint],[data-dspng],[data-edcprint],[data-ddst],[data-ddexp],[data-hper],[data-dexp],[data-dlexp],[data-lexp],[data-dfreset],[data-lfreset],[data-licper],#syncNow,[data-dsf],[data-tpl],[data-dscsv],[data-dsclear],[data-dsparse],#dsCommit,#dsCancel,[data-go],[data-licf],[data-csv],[data-theme],#licCommit,#licCancel,#cardCommit,#cardCancel,#genSummary,#settingsBtn,#menuBtn");
    if (!t) return;
    if (t.dataset.go) { location.hash = t.dataset.go; return; }
    if (t.id === "menuBtn") { const o = $("#side").classList.toggle("open"); t.setAttribute("aria-expanded", String(o)); return; }
    if (t.id === "settingsBtn") { location.hash = "#/settings"; return; }
    if (t.dataset.logout !== undefined) { AUTHUI.logout(); return; }
    if (t.dataset.licf !== undefined) { ui.licF = t.dataset.licf; render(); return; }
    if (t.dataset.ddst !== undefined) { ui.ddSt = t.dataset.ddst; render(); return; }
    if (t.dataset.edcprint !== undefined) { if (ui.ddDay) printEdc(ui.ddDay); return; }
    if (t.dataset.ddexp) { const day = ui.ddDay; exportReport(t.dataset.ddexp, { title: "جدول الأعمال اليومية " + day.date, desc: (ui.ddSt ? "الحالة: " + ui.ddSt : "كل أعمال اليوم") + " · " + dayName(day.date) + " " + U.dmy(day.date), count: ui.ddRows.length, file: "edc-" + day.date, head: EDC_HEAD.concat(["الحالة", "الإنجاز", "ملاحظات"]), rows: ui.ddRows.map((r) => edcRow(r).concat([r.status, r.progress == null ? "" : r.progress + "%", [r.notes, r.delayReason].filter(Boolean).join(" · ")])) }); return; }
    if (t.dataset.dsprint !== undefined) { document.body.classList.add("print-sheet"); setTimeout(() => { window.print(); document.body.classList.remove("print-sheet"); }, 50); return; }
    if (t.dataset.dspng !== undefined) {
      t.disabled = true; t.textContent = "جارٍ تجهيز الصورة…";
      const go = () => html2canvas($("#dsheet"), { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then((c) => { const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "dispatch-" + ($("#dpDate") ? $("#dpDate").value : "") + ".png"; a.click(); }).catch(() => alert("تعذّر إنشاء الصورة. استخدم الطباعة واختر حفظ PDF.")).finally(() => { t.disabled = false; t.textContent = "حفظ صورة PNG"; });
      if (window.html2canvas) go(); else { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; sc.onload = go; sc.onerror = () => { alert("تعذّر تحميل أداة الصور."); t.disabled = false; t.textContent = "حفظ صورة PNG"; }; document.head.appendChild(sc); }
      return;
    }
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
    if (t.dataset.wolink === "off") { if (!confirm("فك ربط حسابك بمنصة أوامر العمل؟")) return; await fetch("/api/auth/wo-unlink", { method: "POST", headers: HUB.Auth.headers() }); HUB.user.woLinked = false; render(); return; }
    if (t.dataset.schm !== undefined) { if (t.dataset.schm) { ui.schM = t.dataset.schm; render(); } return; }
    if (t.dataset.pkcls) { ev.preventDefault(); ui.df = { dims: {}, state: "", from: "", to: "" }; ui.dsQ = ""; ui.dsF = t.dataset.pkcls; location.hash = "#/app/projects/all"; return; }
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
    if (ev.target.id === "schSel") { ui.schM = ev.target.value; render(); return; }
    const tg = ev.target;
    if (tg.dataset && tg.dataset.dfdim) { ui.df.dims[tg.dataset.dfdim] = tg.value; render(); return; }
    if (tg.id === "goSel") { location.hash = "#/go/" + tg.value; return; }
    if (tg.id === "dpDate") { ui.dpDate = tg.value; render(); return; }
    if (tg.id === "ddDate") { ui.ddDate = tg.value; ui.ddSt = ""; render(); return; }
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
    if (ev.target.id === "woLinkForm") {
      ev.preventDefault(); const m = $("#woLinkMsg"); m.className = "msg"; m.textContent = "جارٍ التحقق من الدخول لمنصة أوامر العمل…";
      const r = await fetch("/api/auth/wo-link", { method: "POST", headers: { "content-type": "application/json", ...HUB.Auth.headers() }, body: JSON.stringify({ password: $("#woLinkPw").value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { m.className = "msg err"; m.textContent = j.error || "تعذّر الربط"; return; }
      HUB.user.woLinked = true; render(); return;
    }
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
    if (ev.target.id === "cpForm") { ev.preventDefault(); AUTHUI.changePassword(ev.target, $("#cpMsg")); }
  });

  function applyTheme() { const t = U.ls.get("theme") || "auto"; if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }

  /* ---------- الإقلاع ---------- */
  async function boot() {
    applyTheme();
    $("#today").textContent = U.longDate();
    view.innerHTML = `<div class="empty">جارٍ التحقق من الدخول…</div>`;
    let user = null;
    try { user = await AUTHUI.ensure(); } catch (e) { view.innerHTML = `<div class="panel empty"><h3>تعذّر الاتصال بخادم المنصة</h3><p>${esc(e.message)}</p></div>`; return; }
    if (!user) return;
    // المنصات الظاهرة = ما للمستخدم وصول إليه
    window.REGISTRY = REGISTRY_ALL.filter((p) => (user.access[p.id] || "none") !== "none");
    $("#settingsBtn").textContent = hasCap("users") ? "إدارة البوابة والصلاحيات" : "حسابي";
    $("#userBox").innerHTML = `<b>${esc(user.name)}</b><span>${esc(user.roleLabel)}</span><button type="button" data-logout>تسجيل الخروج</button>`;
    if (!hasCap("assistant")) { const ab = $("#askBtn"); if (ab) ab.hidden = true; }
    // تجهيز ملفات منصة الفواتير مسبقاً في المتصفح (تُخزَّن سنة) فتفتح فوراً عند الضغط عليها
    if ((user.access.invoices || "none") !== "none") setTimeout(() => {
      const I = "https://najran-invoice-intelligence.netlify.app/assets/";
      ["index-hSWEfqZl.js", "react-CzPyxE80.js", "charts-B2dGYJMf.js", "supabase-34S9942t.js", "index-B20oySsw.css", "ExecutivePage-W8q8Jexq.js", "OverviewPage-B-za2wa0.js", "PageShell-D1T_W-OT.js", "ExecBlocks-TM9XDxDJ.js", "Charts-DEkPdR8l.js", "insights-R0Zx6vml.js", "series-plh3BxS7.js"]
        .forEach((f) => { const l = document.createElement("link"); l.rel = "prefetch"; l.href = I + f; l.crossOrigin = "anonymous"; document.head.appendChild(l); });
    }, 2500);
    view.innerHTML = `<div class="empty">جارٍ تحميل بيانات الفرع…</div>`;
    await HUB.loadAll();
    $("#syncTxt").textContent = Store.online ? "متصل بقاعدة البيانات المشتركة" : "وضع محلي: الحفظ على هذا الجهاز";
    render();
    HUB.pushContext();
  }
  window.VIEWS = { render };
  boot();
})();
