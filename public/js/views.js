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
  const ui = { licF: "", licQ: "", cardQ: "", pendLic: null, pendCards: null };

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
  function home() {
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
    view.innerHTML = `
      <div class="hero">
        <div class="brief">
          <p class="when">موقف الفرع · ${U.longDate()}</p>
          <p class="line">${line}</p>
          <p class="sub">${sub}</p>
          <div class="acts"><button class="btn pri" type="button" data-ask="اكتب ملخص اليوم للإدارة العليا">ملخص اليوم من المساعد</button><a class="btn" href="#gaps">نواقص البيانات (${E.gaps.length})</a></div>
        </div>
        <div class="tower" aria-label="برج الفرع">
          <h2>برج الفرع <span class="num">${E.overall ?? "—"}%</span></h2>
          <p>كل طبقة منصة؛ طولها نسبة سلامتها ولونها حالتها. الطبقة المخططة بلا بيانات.</p>
          <div class="tiers">${tiers}</div><div class="base"></div>
        </div>
      </div>
      <section class="section"><h2>المنصات</h2><p class="hint">رقم واحد لكل منصة وأهم ما فيها. اضغط أي صف لفتحها.</p><div class="ledger">${rows}</div></section>
      <section class="section two">
        <div class="panel"><h3>تحتاج قراراً</h3><p class="hint">مرتبة من الأخطر. كل تنبيه يفتح مكانه.</p>
          ${E.alerts.length ? `<ul class="list">${E.alerts.map(li).join("")}</ul>` : `<div class="empty">لا تنبيهات اليوم.</div>`}</div>
        <div class="panel" id="gaps"><h3>نواقص البيانات</h3><p class="hint">ما ينقص ليكون التقرير كاملاً وصحيحاً.</p>
          ${E.gaps.length ? `<ul class="list">${E.gaps.map(li).join("")}</ul>` : `<div class="empty">البيانات مكتملة.</div>`}</div>
      </section>
      <section class="section panel"><h3>ملخص الإدارة العليا اليومي</h3>
        <p class="hint">يكتبه المساعد الذكي تلقائياً كل صباح 8:10 بتوقيت الرياض من بيانات كل المنصات.</p>
        ${sm && sm.text ? `<p class="summary-text">${esc(sm.text)}</p><p class="meta">كُتب ${esc(new Date(sm.at).toLocaleString("ar-SA-u-nu-latn"))}</p>` : `<div class="empty"><h3>لم يُكتب ملخص اليوم بعد</h3><p>اطلبه الآن من المساعد، أو انتظر الملخص التلقائي صباح الغد.</p></div>`}
        <div class="acts" style="margin-top:12px"><button class="btn" type="button" id="genSummary">اكتب الملخص الآن واحفظه</button></div>
        <p class="msg" id="sumMsg" role="status"></p>
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

  /* ---------- منصة مرتبطة ---------- */
  function spark(vals) {
    const v = vals.map(Number).filter((x) => !isNaN(x));
    if (v.length < 2) return "";
    const mx = Math.max(...v), mn = Math.min(...v), W = 200, H = 40;
    const pts = v.map((x, i) => `${(W - (i / (v.length - 1)) * W).toFixed(1)},${(H - 4 - ((x - mn) / (mx - mn || 1)) * (H - 8)).toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--mud)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function linkedApp(p, tab) {
    const arr = S.snapshots[p.id] || [];
    const s = arr[arr.length - 1];
    const ev = E.items.find((i) => i.id === p.id);
    tab = tab || "summary";
    const tabs = [["summary", "الملخص"], ["board", "لوحة المنصة"], ["entry", "إدخال القراءة"], ["alerts", "التنبيهات", ev.alerts.length + ev.gaps.length]];
    let body = "";
    if (tab === "board") body = frame(p.url, p.name);
    else if (tab === "summary") {
      if (!s) body = `<div class="panel empty"><h3>لا توجد قراءة لهذه المنصة بعد</h3><p>البوابة لا تستطيع قراءة أرقام هذه المنصة تلقائياً لأنها منشورة منفصلة. افتح «لوحة المنصة»، ثم أدخل أرقامها الرئيسية في «إدخال القراءة» لتدخل في تقرير الفرع والمساعد.</p><button class="btn pri" data-go="${link(p.id, "entry")}" type="button">أدخل أول قراءة</button></div>`;
      else {
        body = kpis(p.fields.map((f) => [f.label + (f.unit ? ` (${f.unit})` : ""), U.fmt(s.values[f.key])]).concat([["الحالة", LV[ev.level], ev.level === "ok" ? "ok" : ev.level === "bad" ? "bad" : ev.level === "warn" ? "warn" : ""]])) +
          `<p class="meta">آخر قراءة ${U.dmy(s.date)}${s.note ? " · " + esc(s.note) : ""}. ${esc(ev.issue)}</p>
          <div class="section two">${p.fields.map((f) => `<div class="panel"><h3>${esc(f.label)}</h3><p class="hint">آخر ${Math.min(arr.length, 30)} قراءة</p>${spark(arr.slice(-30).map((x) => x.values[f.key])) || '<p class="hint">يظهر الاتجاه بعد قراءتين.</p>'}</div>`).join("")}</div>
          <section class="section"><h2>سجل القراءات</h2><div class="tbl"><table><thead><tr><th>التاريخ</th>${p.fields.map((f) => `<th>${esc(f.label)}</th>`).join("")}<th>ملاحظة</th></tr></thead><tbody>
          ${arr.slice().reverse().map((x) => `<tr><td>${U.dmy(x.date)}</td>${p.fields.map((f) => `<td class="num">${U.fmt(x.values[f.key])}</td>`).join("")}<td>${esc(x.note || "")}</td></tr>`).join("")}</tbody></table></div></section>`;
      }
    } else if (tab === "entry") {
      const d = U.iso(U.today());
      body = `<div class="panel"><h3>إدخال قراءة ${esc(p.short)}</h3><p class="hint">انسخ الأرقام من «لوحة المنصة». قراءة نفس اليوم تستبدل السابقة. تُحفظ في القاعدة المشتركة فتظهر على كل الأجهزة.</p>
        <form class="form" id="snapForm" data-app="${p.id}">
          <label class="f">التاريخ<input type="date" name="date" value="${d}" required></label>
          ${p.fields.map((f) => `<label class="f">${esc(f.label)}${f.unit ? ` (${f.unit})` : ""}<input type="number" step="any" min="0" inputmode="decimal" name="${f.key}" value="${s && s.date === d ? s.values[f.key] ?? "" : ""}"></label>`).join("")}
          <label class="f" style="grid-column:1/-1">ملاحظة (اختياري)<input type="text" name="note" maxlength="200" placeholder="مثال: توقف فريقين بسبب الأمطار"></label>
          <div><button class="btn pri" type="submit">حفظ القراءة</button></div></form><p class="msg" id="snapMsg" role="status"></p></div>`;
    } else {
      const all = ev.alerts.concat(ev.gaps);
      body = `<div class="panel">${all.length ? `<ul class="list">${all.map((x) => `<li class="lvl-${x.level}"><div>${esc(x.text)}</div></li>`).join("")}</ul>` : `<div class="empty">لا تنبيهات لهذه المنصة.</div>`}</div>`;
    }
    view.innerHTML = appShell(p, tabs, tab, body);
  }

  /* ---------- الرخص ---------- */
  const LCOL = { N7: "#9B6B3F", N5: "#7A5BA8", N4: "#D99A0B", N6: "#3F7CB5", N2: "#C2312A", N3: "#D9702B", N1: "#17715F", N9: "#6B747A" };
  function licensesApp(p, tab) {
    tab = tab || "overview";
    const rows = HUB.licRows();
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
      body = stale + kpis([["إجمالي الرخص", rows.length], ["مغلقة بإخلاء طرف", rows.length - open.length, "ok"], ["مفتوحة", open.length, "warn"], ["متجاوزة المدة", over.length, "bad"], ["أقدم تجاوز (يوم)", over.length ? over[0].over : 0, "bad"]]) +
        `<div class="section two"><div class="panel"><h3>توزيع الرخص حسب الموقف</h3><p class="hint">الأعلى أبعدها عن الإغلاق.</p><div class="bars">${order.map((c) => `<div class="bar" style="--c:${LCOL[c]}"><span>${esc((HUB.LIC_CLS[c] || { short: "غير مصنفة" }).short || HUB.LIC_CLS[c].name)}</span><span class="tr"><span class="fl" style="width:${(cnt[c] / rows.length) * 100}%"></span></span><span class="v num">${cnt[c]}</span></div>`).join("")}</div></div>
        <div class="panel"><h3>ترتيب التجاوز</h3><p class="hint">أيام منذ انتهاء المدة للرخص المفتوحة.</p><div class="bars">${over.map((r) => `<div class="bar" style="--c:${LCOL[r.cls]}"><span>${esc(r.loc)} <span class="ltr num" style="color:var(--muted)">${r.id.slice(-5)}</span></span><span class="tr"><span class="fl" style="width:${(r.over / mx) * 100}%"></span></span><span class="v num">${r.over}</span></div>`).join("") || '<p class="hint">لا رخص متجاوزة.</p>'}</div></div></div>`;
    } else if (tab === "list") {
      const cnt = {}; rows.forEach((r) => (cnt[r.cls] = (cnt[r.cls] || 0) + 1));
      const q = ui.licQ.trim();
      const list = rows.filter((r) => (!ui.licF || r.cls === ui.licF) && (!q || (r.id + r.wo + r.loc + r.eng + r.st).includes(q)))
        .sort((a, b) => ((HUB.LIC_CLS[a.cls] || {}).order || 99) - ((HUB.LIC_CLS[b.cls] || {}).order || 99) || (b.over || 0) - (a.over || 0));
      body = stale + `<div class="chips"><button class="chip" data-licf="" aria-pressed="${!ui.licF}" type="button">الكل ${rows.length}</button>${Object.keys(cnt).map((c) => `<button class="chip" style="--c:${LCOL[c]}" data-licf="${c}" aria-pressed="${ui.licF === c}" type="button"><i></i>${esc((HUB.LIC_CLS[c] || {}).short || "غير مصنفة")} ${cnt[c]}</button>`).join("")}</div>
        <label class="f" style="max-width:340px;margin-bottom:12px">بحث<input type="search" id="licQ" value="${esc(ui.licQ)}" placeholder="رقم الرخصة، أمر العمل، الموقع، المهندس"></label>
        <div class="tbl"><table><thead><tr><th>الرخصة</th><th>الموقع</th><th>المهندس</th><th>الانتهاء</th><th>الحالة</th><th>سبب التأخر</th><th>الإجراء المطلوب</th></tr></thead><tbody>
        ${list.map((r) => `<tr><td class="ltr num">${esc(r.id)}<br><small style="color:var(--muted)">أمر ${esc(r.wo)}</small></td><td>${esc(r.loc)}</td><td>${esc(r.eng)}</td><td class="num">${U.dmy(r.end)}</td>
          <td>${r.closed ? '<span class="pill p-ok">مغلقة</span>' : r.over > 0 ? `<span class="pill p-bad">متجاوزة ${r.over} يوم</span>` : `<span class="pill p-warn">سارية ${-r.over} يوم</span>`}<br><small style="color:var(--muted)">${esc(r.clsName)}</small></td>
          <td class="wrap">${esc(r.why || "")}</td><td class="wrap">${esc(r.act)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">لا نتائج مطابقة.</td></tr>`}</tbody></table></div>`;
    } else if (tab === "eng") {
      const engs = [...new Set(rows.map((r) => r.eng || "غير محدد"))];
      const data = engs.map((e) => { const a = rows.filter((r) => (r.eng || "غير محدد") === e), o = a.filter((r) => !r.closed), ov = o.filter((r) => r.over > 0); return { e, a: a.length, o: o.length, ov: ov.length, max: ov.length ? Math.max(...ov.map((r) => r.over)) : 0 }; }).sort((x, y) => y.ov - x.ov || y.o - x.o);
      body = stale + `<div class="tbl"><table><thead><tr><th>المهندس</th><th>إجمالي الرخص</th><th>مغلقة</th><th>مفتوحة</th><th>متجاوزة</th><th>أقدم تجاوز (يوم)</th><th>نسبة الإغلاق</th></tr></thead><tbody>
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
  function cardTable(list) {
    const q = ui.cardQ.trim().toLowerCase();
    const rows = q ? list.filter((c) => (c.emp + " " + c.name + " " + c.iqama + " " + c.badge + " " + (c.remark || "")).toLowerCase().includes(q)) : list;
    return `<label class="f" style="max-width:340px;margin-bottom:12px">بحث<input type="search" id="cardQ" value="${esc(ui.cardQ)}" placeholder="الاسم، رقم الموظف، الإقامة"></label>
      <div class="tbl"><table><thead><tr><th>#</th><th>رقم الموظف</th><th>الاسم</th><th>الإقامة</th><th>بطاقة المقاول</th><th>الانتهاء</th><th>الأيام</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>
      ${rows.map((c, i) => `<tr><td class="num">${i + 1}</td><td class="ltr">${esc(c.emp)}</td><td class="ltr" style="text-align:right">${esc(c.name)}</td><td class="ltr num">${esc(c.iqama)}</td><td class="ltr">${esc(c.badge)}</td><td class="num">${U.dmy(c.exp)}</td><td class="num">${c.left}</td><td><span class="pill ${SP[c.st]}">${HUB.CARD_ST[c.st]}</span></td><td>${esc(c.remark || "")}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">لا نتائج مطابقة.</td></tr>`}</tbody></table></div>`;
  }
  function safetyApp(p, tab) {
    tab = tab || "overview";
    const rows = HUB.cardRows();
    const exp = rows.filter((c) => c.st === "expired"), soon = rows.filter((c) => c.st === "week" || c.st === "soon"), valid = rows.filter((c) => c.st !== "expired");
    const tabs = [["overview", "الصورة العامة"], ["expired", "منتهية", exp.length], ["soon", "تنتهي خلال 30 يوماً", soon.length], ["all", "كل السجل", rows.length], ["data", "تحديث البيانات"], ["site", "المنصة المنشورة"]];
    let body = "";
    if (tab === "overview") {
      const t = U.today(), b = [];
      for (let i = 0; i < 12; i++) { const m = (t.getMonth() + i) % 12, y = t.getFullYear() + Math.floor((t.getMonth() + i) / 12), key = y + "-" + String(m + 1).padStart(2, "0"); b.push({ l: U.month(m), v: valid.filter((c) => c.exp.slice(0, 7) === key).length }); }
      const mx = Math.max(1, ...b.map((x) => x.v));
      body = kpis([["إجمالي العمال", rows.length], ["بطاقات سارية", valid.length, "ok"], ["منتهية", exp.length, "bad"], ["تنتهي خلال 7 أيام", rows.filter((c) => c.st === "week").length, "warn"], ["تنتهي خلال 30 يوماً", soon.length, "warn"]]) +
        `<div class="section two"><div class="panel"><h3>المنتهية — الأقدم أولاً</h3><p class="hint">عامل ببطاقة منتهية لا يدخل موقع العمل.</p><div class="bars">${exp.slice(0, 14).map((c) => `<div class="bar" style="--c:var(--bad)"><span class="ltr" style="text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><span class="tr"><span class="fl" style="width:${Math.min(100, (-c.left / Math.max(...exp.map((x) => -x.left))) * 100)}%"></span></span><span class="v num">${-c.left}</span></div>`).join("") || '<p class="hint">لا بطاقات منتهية.</p>'}</div>${exp.length > 14 ? `<p class="meta"><a href="${link("safety", "expired")}">عرض الـ ${exp.length} كلها</a></p>` : ""}</div>
        <div class="panel"><h3>متى تنتهي السارية؟</h3><p class="hint">عدد البطاقات التي ينتهي سريانها كل شهر، لتعرف متى يزدحم التجديد.</p><div class="bars">${b.map((x, i) => `<div class="bar" style="--c:${i < 1 ? "var(--volt)" : "var(--ink)"}"><span>${x.l}</span><span class="tr"><span class="fl" style="width:${(x.v / mx) * 100}%"></span></span><span class="v num">${x.v}</span></div>`).join("")}</div></div></div>`;
    } else if (tab === "expired") body = cardTable(exp);
    else if (tab === "soon") body = cardTable(soon);
    else if (tab === "all") body = cardTable(rows);
    else if (tab === "data") {
      body = `<div class="panel"><h3>رفع ملف بطاقات السلامة</h3><p class="hint">الورقة الأولى من الملف: رقم الموظف، الاسم، الإقامة، بطاقة المقاول، SAP، تاريخ الانتهاء، الملاحظات. التواريخ مثل 21-November-26 تُقرأ كما هي.</p>
        <div class="drop"><p style="margin:0 0 10px">اختر الملف</p><input type="file" id="cardFile" accept=".xlsx,.xls,.csv"></div><div id="cardPend"></div><p class="msg" id="cardMsg" role="status"></p></div>
        <div class="panel section"><h3>تنزيل السجل</h3><p class="hint">${rows.length} بطاقة.</p><button class="btn" type="button" data-csv="cards">تنزيل CSV</button></div>`;
    } else body = frame(p.url, "منصة بطاقات السلامة المنشورة");
    view.innerHTML = appShell(p, tabs, tab, body);
    if (tab === "data" && ui.pendCards) renderCardPend();
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
    else { const p = reg(r.app); if (p.kind === "linked") linkedApp(p, r.tab); else if (p.id === "licenses") licensesApp(p, r.tab); else safetyApp(p, r.tab); }
    $("#side").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  }
  window.addEventListener("hashchange", () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- الأحداث ---------- */
  function download(name, rows) {
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const blob = new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n\r\n" + q("Project Manager | Eng. Ahmed Zahran")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-go],[data-licf],[data-csv],[data-theme],#licCommit,#licCancel,#cardCommit,#cardCancel,#genSummary,#settingsBtn,#menuBtn");
    if (!t) return;
    if (t.dataset.go) { location.hash = t.dataset.go; return; }
    if (t.id === "menuBtn") { const o = $("#side").classList.toggle("open"); t.setAttribute("aria-expanded", String(o)); return; }
    if (t.id === "settingsBtn") { location.hash = "#/settings"; return; }
    if (t.dataset.licf !== undefined) { ui.licF = t.dataset.licf; render(); return; }
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
    if (ev.target.id === "cardQ") { ui.cardQ = ev.target.value; render(); const i = $("#cardQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  document.addEventListener("change", (ev) => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const isLic = ev.target.id === "licFile", isCard = ev.target.id === "cardFile"; if (!isLic && !isCard) return;
    const m = $(isLic ? "#licMsg" : "#cardMsg");
    if (typeof XLSX === "undefined") { m.className = "msg err"; m.textContent = "مكتبة قراءة Excel لم تُحمّل بعد. تحقق من الاتصال وأعد المحاولة."; return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const buf = new Uint8Array(rd.result);
        if (isLic) { ui.pendLic = parseLicenses(buf, $("#licSwap").checked); renderLicPend(); }
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
