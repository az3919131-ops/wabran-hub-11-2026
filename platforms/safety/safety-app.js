/*
  تطبيق بطاقات السلامة — نسخة واحدة تعمل داخل البوابة وعلى موقعها المستقل (najran-safety-cards.netlify.app).
  البيانات من القاعدة المشتركة للبوابة (/api/data?key=cards)، فأي تحديث من أي مكان يظهر في الآخر.
  SafetyApp.mount(element, { api, onChange, seed })
*/
(function () {
  "use strict";
  const DAY = 864e5;
  const MON = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const ST = { expired: "منتهية", week: "تنتهي خلال 7 أيام", soon: "تنتهي خلال 30 يوماً", valid: "سارية" };
  const SP = { expired: "p-bad", week: "p-warn", soon: "p-warn", valid: "p-ok" };
  const GRP = { S: "سعودي", I: "هندي", B: "بنغلاديشي", F: "فلبيني", SD: "سوداني", N: "نيبالي", P: "باكستاني", G: "غاني" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const pISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  const dmy = (s) => { if (!s) return "—"; const d = pISO(s); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
  const grpOf = (emp) => String(emp || "").split("-")[0].toUpperCase();
  const remarkCat = (r) => { const t = String(r || "").toUpperCase(); if (/VACATION|EXIT|اجاز/.test(t)) return "vac"; if (/EXPIRED\b(?!.*GOING)/.test(t) && !/GOING/.test(t)) return "exp"; if (/GOING/.test(t)) return "going"; if (/VALID/.test(t)) return "valid"; return t ? "other" : "none"; };
  const RC = { exp: "ملاحظة: منتهية", going: "ملاحظة: على وشك الانتهاء", valid: "ملاحظة: سارية", vac: "إجازة / خروج", other: "ملاحظات أخرى", none: "بلا ملاحظة" };

  function enrich(rows) {
    const t = today();
    return rows.map((c) => {
      const left = c.exp ? Math.round((pISO(c.exp) - t) / DAY) : null;
      const st = left == null ? "expired" : left < 0 ? "expired" : left <= 7 ? "week" : left <= 30 ? "soon" : "valid";
      return { ...c, left, st, grp: grpOf(c.emp), rc: remarkCat(c.remark) };
    }).sort((a, b) => (a.left ?? -1e9) - (b.left ?? -1e9));
  }

  /* ---------- Excel / CSV ---------- */
  const MAP = { emp: /^emp|رقمالموظف/, name: /name|الاسم/, iqama: /iqama|الإقامة|الاقامة/, badge: /badge|بطاقةالمقاول/, sap: /^sap/, exp: /expiry|انتهاء/, remark: /remark|ملاحظ/ };
  function parseDate(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date) { const t = new Date(v.getTime() + 12 * 36e5); return iso(new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
    if (typeof v === "number") return iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY + 12 * 36e5));
    const s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2,4})$/))) { const k = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[2].slice(0, 3).toLowerCase()); if (k < 0) return null; let y = +m[3]; if (y < 100) y += 2000; return y + "-" + String(k + 1).padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
    return null;
  }
  function parseWorkbook(buf) {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    let hi = -1, col = {};
    for (let i = 0; i < Math.min(rows.length, 30) && hi < 0; i++) {
      const cm = {}; rows[i].forEach((h, j) => { const t = String(h).toLowerCase().replace(/\s+/g, ""); Object.keys(MAP).forEach((k) => { if (cm[k] == null && t && MAP[k].test(t)) cm[k] = j; }); });
      if (cm.emp != null && cm.exp != null) { hi = i; col = cm; }
    }
    if (hi < 0) throw new Error("لم أجد صف العناوين. يلزم عمود رقم الموظف وعمود تاريخ الانتهاء.");
    const g = (r, k) => (col[k] != null ? String(r[col[k]] ?? "").trim().replace(/^-$/, "") : "");
    const out = [], skipped = [], seen = {};
    for (const r of rows.slice(hi + 1)) {
      const emp = g(r, "emp"); if (!emp) continue;
      const exp = parseDate(r[col.exp]); if (!exp) { skipped.push(emp); continue; }
      if (seen[emp]) continue; seen[emp] = 1;
      out.push({ emp, name: g(r, "name").replace(/\s+/g, " "), iqama: g(r, "iqama"), badge: g(r, "badge"), sap: g(r, "sap"), exp, remark: g(r, "remark") });
    }
    return { list: out, skipped, sheet: wb.SheetNames[0] };
  }

  function mount(el, opt) {
    const api = opt.api;
    const H = () => (opt.headers ? opt.headers() : {});
    const canEdit = opt.canEdit !== false, canExport = opt.canExport !== false;
    const S = { rows: [], asof: "", tab: "overview", f: { st: "", q: "", grp: "", rc: "", from: "", to: "" }, pending: null, sort: "left", msg: "" };
    try { const t = localStorage.getItem("sc_tab2"); if (t) S.tab = t; } catch (e) {}

    async function load() {
      el.innerHTML = '<div class="sa-empty">جارٍ تحميل البطاقات…</div>';
      try {
        const r = await fetch(api + "?key=cards", { cache: "no-store", headers: H() });
        if (r.status === 401 || r.status === 403) { const j0 = await r.json().catch(() => ({})); S.rows = []; S.msg = j0.error || "لا تملك صلاحية عرض البطاقات"; return render(); }
        const j = await r.json();
        const v = j.value && j.value.rows ? j.value : opt.seed;
        S.rows = v.rows; S.asof = v.asof || "";
      } catch (e) { S.rows = (opt.seed && opt.seed.rows) || []; S.asof = (opt.seed && opt.seed.asof) || ""; S.msg = "تعذّر الاتصال بالقاعدة المشتركة؛ تُعرض آخر نسخة محفوظة."; }
      render();
    }
    async function save(rows, mode) {
      const val = { asof: iso(today()), rows };
      const r = await fetch(api + "?key=cards", { method: "PUT", headers: { "content-type": "application/json", ...H() }, body: JSON.stringify(val) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "تعذّر الحفظ (" + r.status + ")");
      S.rows = rows; S.asof = val.asof; if (opt.onChange) opt.onChange(val);
    }

    const all = () => enrich(S.rows);
    function filtered() {
      const f = S.f, q = f.q.trim().toLowerCase();
      return all().filter((c) => (!f.st || (f.st === "soon30" ? c.left >= 0 && c.left <= 30 : f.st === "notexp" ? c.left >= 0 : c.st === f.st))
        && (!f.grp || c.grp === f.grp) && (!f.rc || c.rc === f.rc)
        && (!f.from || c.exp >= f.from) && (!f.to || c.exp <= f.to)
        && (!q || [c.emp, c.name, c.iqama, c.badge, c.sap, c.remark].join(" ").toLowerCase().includes(q)));
    }
    function describe() {
      const f = S.f, p = [];
      if (f.st) p.push({ expired: "منتهية", week: "تنتهي خلال 7 أيام", soon30: "تنتهي خلال 30 يوماً", notexp: "سارية", valid: "سارية أكثر من 30 يوماً" }[f.st] || f.st);
      if (f.grp) p.push("الفئة: " + (GRP[f.grp] || f.grp));
      if (f.rc) p.push(RC[f.rc]);
      if (f.from) p.push("انتهاء من " + dmy(f.from)); if (f.to) p.push("انتهاء حتى " + dmy(f.to));
      if (f.q) p.push("بحث: " + f.q);
      return p.length ? p.join(" · ") : "كل البطاقات";
    }

    /* ---------- export ---------- */
    const HEAD = ["م", "رقم الموظف", "الاسم", "الفئة", "رقم الإقامة", "بطاقة المقاول", "SAP", "تاريخ الانتهاء", "الأيام المتبقية", "الحالة", "ملاحظات"];
    const rowOut = (c, i) => [i + 1, c.emp, c.name, GRP[c.grp] || c.grp, c.iqama, c.badge, c.sap, c.exp ? dmy(c.exp) : "", c.left, ST[c.st], c.remark];
    function fileBase() { return "safety-cards-" + (S.f.st || "all") + "-" + iso(today()); }
    function dl(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
    function exportXlsx(list) {
      if (typeof XLSX === "undefined") { alert("مكتبة Excel لم تُحمّل بعد. تحقق من الاتصال."); return; }
      const aoa = [["تقرير بطاقات السلامة — الوبران نجران"], ["التقرير: " + describe()], ["تاريخ التقرير: " + dmy(iso(today())) + " · عدد البطاقات: " + list.length], [], HEAD].concat(list.map(rowOut));
      aoa.push([]); aoa.push(["Project Manager | Eng. Ahmed Zahran"]);
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [5, 10, 34, 11, 13, 12, 11, 13, 12, 18, 34].map((w) => ({ wch: w }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "التقرير"); wb.Workbook = { Views: [{ RTL: true }] };
      dl(fileBase() + ".xlsx", new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }));
    }
    function exportCsv(list) {
      const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const lines = [[ "التقرير: " + describe()], HEAD].concat(list.map(rowOut)).concat([[], ["Project Manager | Eng. Ahmed Zahran"]]);
      dl(fileBase() + ".csv", new Blob(["﻿" + lines.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    }
    function printReport(list) {
      const w = window.open("", "_blank"); if (!w) { alert("اسمح بالنوافذ المنبثقة للطباعة."); return; }
      w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير بطاقات السلامة</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#13262F}h1{font-size:20px;margin:0}p{margin:4px 0 12px;color:#555}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:right}th{background:#13262F;color:#fff}tr.expired td{background:#fbe3e0}.sign{margin-top:24px;direction:ltr;text-align:center;font-weight:bold}</style></head><body>
        <h1>تقرير بطاقات السلامة — الوبران نجران</h1><p>${esc(describe())} · ${list.length} بطاقة · ${dmy(iso(today()))}</p>
        <table><thead><tr>${HEAD.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${list.map((c, i) => `<tr class="${c.st}">${rowOut(c, i).map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <div class="sign">Project Manager | Eng. Ahmed Zahran</div><script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
    }

    /* ---------- views ---------- */
    function kpi(label, v, cls, f) { return `<button class="sa-kpi ${cls || ""}" type="button" data-preset="${f || ""}"><b>${v}</b><span>${label}</span></button>`; }
    function overview() {
      const A = all(), exp = A.filter((c) => c.st === "expired"), wk = A.filter((c) => c.st === "week"), s30 = A.filter((c) => c.left >= 0 && c.left <= 30);
      const groups = [...new Set(A.map((c) => c.grp))].map((g) => { const a = A.filter((c) => c.grp === g); return { g, n: a.length, e: a.filter((c) => c.st === "expired").length, s: a.filter((c) => c.left >= 0 && c.left <= 30).length }; }).sort((a, b) => b.e - a.e || b.n - a.n);
      const t = today(), months = [];
      for (let i = 0; i < 12; i++) { const d = new Date(t.getFullYear(), t.getMonth() + i, 1), k = iso(d).slice(0, 7); months.push({ k, l: MON[d.getMonth()] + " " + d.getFullYear(), n: A.filter((c) => c.left >= 0 && c.exp && c.exp.startsWith(k)).length }); }
      const mx = Math.max(1, ...months.map((m) => m.n));
      return `<div class="sa-kpis">${kpi("إجمالي العمال", A.length, "", "all")}${kpi("سارية", A.filter((c) => c.left >= 0).length, "ok", "notexp")}${kpi("منتهية", exp.length, "bad", "expired")}${kpi("تنتهي خلال 7 أيام", wk.length, "warn", "week")}${kpi("تنتهي خلال 30 يوماً", s30.length, "warn", "soon30")}</div>
        <p class="sa-hint">اضغط أي رقم لفتح تقريره مع إمكانية الفلترة والتصدير.</p>
        <div class="sa-two">
          <div class="sa-panel"><h3>حسب الفئة</h3><table class="sa-t"><thead><tr><th>الفئة</th><th>العمال</th><th>منتهية</th><th>خلال 30 يوماً</th><th></th></tr></thead><tbody>
            ${groups.map((g) => `<tr><td>${esc(GRP[g.g] || g.g)} <span class="sa-mut">(${esc(g.g)})</span></td><td>${g.n}</td><td>${g.e ? `<span class="pill p-bad">${g.e}</span>` : 0}</td><td>${g.s}</td><td><button class="btn sm" type="button" data-grp="${esc(g.g)}">تقرير</button></td></tr>`).join("")}</tbody></table></div>
          <div class="sa-panel"><h3>متى تنتهي السارية؟</h3><p class="sa-hint">عدد البطاقات التي تنتهي في كل شهر. اضغط الشهر لتقريره.</p>
            <div class="sa-bars">${months.map((m) => `<button class="sa-bar" type="button" data-month="${m.k}"><span>${m.l}</span><span class="tr"><span class="fl" style="width:${(m.n / mx) * 100}%"></span></span><span class="v">${m.n}</span></button>`).join("")}</div></div>
        </div>
        <div class="sa-panel"><h3>المنتهية — الأقدم أولاً</h3>${exp.length ? table(exp.slice(0, 15)) + (exp.length > 15 ? `<p class="sa-hint"><button class="btn sm" type="button" data-preset="expired">عرض الـ ${exp.length} كلها</button></p>` : "") : '<div class="sa-empty">لا بطاقات منتهية.</div>'}</div>`;
    }
    function table(list) {
      return `<div class="sa-tbl"><table class="sa-t"><thead><tr>${HEAD.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>
        ${list.map((c, i) => `<tr><td>${i + 1}</td><td class="ltr">${esc(c.emp)}</td><td class="ltr sa-name">${esc(c.name)}</td><td>${esc(GRP[c.grp] || c.grp)}</td><td class="ltr">${esc(c.iqama)}</td><td class="ltr">${esc(c.badge)}</td><td class="ltr">${esc(c.sap)}</td><td>${dmy(c.exp)}</td><td>${c.left ?? "—"}</td><td><span class="pill ${SP[c.st]}">${ST[c.st]}</span></td><td>${esc(c.remark)}</td></tr>`).join("") || `<tr><td colspan="${HEAD.length}" class="sa-empty">لا نتائج مطابقة للفلاتر.</td></tr>`}</tbody></table></div>`;
    }
    function report() {
      const f = S.f, list = filtered(), A = all();
      const grps = [...new Set(A.map((c) => c.grp))].sort();
      const sel = (id, v, opts) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      return `<div class="sa-panel sa-filters">
          <div class="sa-presets">${[["", "الكل"], ["expired", "منتهية"], ["week", "خلال 7 أيام"], ["soon30", "خلال 30 يوماً"], ["notexp", "سارية"]].map(([k, l]) => `<button class="chip" type="button" data-st="${k}" aria-pressed="${f.st === k}">${l}</button>`).join("")}</div>
          <div class="sa-grid">
            <label>بحث<input type="search" id="saQ" value="${esc(f.q)}" placeholder="الاسم، رقم الموظف، الإقامة، SAP"></label>
            <label>الفئة${sel("saGrp", f.grp, [["", "كل الفئات"]].concat(grps.map((g) => [g, (GRP[g] || g) + " (" + g + ")"])))}</label>
            <label>الملاحظة${sel("saRc", f.rc, [["", "الكل"]].concat(Object.entries(RC)))}</label>
            <label>الانتهاء من<input type="date" id="saFrom" value="${esc(f.from)}"></label>
            <label>الانتهاء حتى<input type="date" id="saTo" value="${esc(f.to)}"></label>
          </div>
          <div class="sa-actions"><span class="sa-mut">${esc(describe())} — <b>${list.length}</b> بطاقة</span>
            <span class="sa-btns">${canExport ? '<button class="btn pri" type="button" data-exp="xlsx">تصدير Excel</button><button class="btn" type="button" data-exp="csv">تصدير CSV</button><button class="btn" type="button" data-exp="print">طباعة / PDF</button>' : '<span class="sa-mut">التصدير غير متاح لصلاحيتك</span>'}<button class="btn" type="button" data-reset>مسح الفلاتر</button></span></div>
        </div>${table(list)}`;
    }
    function data() {
      const P = S.pending;
      return `<div class="sa-panel"><h3>رفع ملف بطاقات السلامة</h3><p class="sa-hint">الورقة الأولى: رقم الموظف، الاسم، الإقامة، بطاقة المقاول، SAP، تاريخ الانتهاء، الملاحظات. الحفظ يذهب للقاعدة المشتركة فيظهر في البوابة والموقع المستقل معاً.</p>
        <div class="sa-drop"><input type="file" id="saFile" accept=".xlsx,.xls,.csv"></div>
        ${P ? `<div class="sa-pend"><b>قرأت ${P.list.length} بطاقة من «${esc(P.sheet)}».</b>${P.skipped.length ? `<div class="note">تخطيت ${P.skipped.length} صفاً بتاريخ غير مفهوم: ${esc(P.skipped.slice(0, 6).join("، "))}</div>` : ""}
          <div class="sa-btns"><button class="btn pri" type="button" data-commit="replace">استبدال كل السجل</button><button class="btn" type="button" data-commit="merge">تحديث الموجودين وإضافة الجدد</button><button class="btn" type="button" data-cancel>إلغاء</button></div></div>` : ""}
        <p class="sa-msg" id="saMsg">${esc(S.msg)}</p></div>
        <div class="sa-panel"><h3>تجديد أو إضافة بطاقة</h3>
          <form class="sa-grid" id="saForm"><label>رقم الموظف<input id="fEmp" required list="saEmps" placeholder="مثال: S-1156"><datalist id="saEmps">${S.rows.map((c) => `<option value="${esc(c.emp)}">${esc(c.name)}</option>`).join("")}</datalist></label>
          <label>الاسم (لموظف جديد)<input id="fName"></label><label>تاريخ الانتهاء الجديد<input type="date" id="fExp" required></label><label>ملاحظة<input id="fRem" placeholder="ID VALIDE"></label>
          <div><button class="btn pri" type="submit">حفظ</button></div></form>
          <p class="sa-hint">آخر تحديث للسجل: ${dmy(S.asof)} · ${S.rows.length} بطاقة.</p></div>`;
    }
    function render() {
      const A = all();
      const tabs = [["overview", "الصورة العامة"], ["report", "التقارير والتصدير", filtered().length]].concat(canEdit ? [["data", "تحديث البيانات"]] : []);
      if (S.tab === "data" && !canEdit) S.tab = "overview";
      el.innerHTML = `<div class="sa">${S.msg && S.tab !== "data" ? `<div class="note">${esc(S.msg)}</div>` : ""}
        <div class="sa-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${l}${n != null ? ` <span class="count">${n}</span>` : ""}</button>`).join("")}</div>
        <div>${S.tab === "report" ? report() : S.tab === "data" ? data() : overview()}</div>
        <p class="sa-mut sa-foot">${A.length} بطاقة · آخر تحديث ${dmy(S.asof)}</p></div>`;
    }
    function setTab(t) { S.tab = t; try { localStorage.setItem("sc_tab2", t); } catch (e) {} render(); }
    function preset(st) { S.f = { st: st === "all" ? "" : st, q: "", grp: "", rc: "", from: "", to: "" }; setTab("report"); }

    el.addEventListener("click", async (ev) => {
      const b = ev.target.closest("button"); if (!b || !el.contains(b)) return;
      const d = b.dataset;
      if (d.tab) return setTab(d.tab);
      if (d.preset !== undefined) return preset(d.preset);
      if (d.grp) { S.f = { st: "", q: "", grp: d.grp, rc: "", from: "", to: "" }; return setTab("report"); }
      if (d.month) { const [y, m] = d.month.split("-").map(Number); S.f = { st: "notexp", q: "", grp: "", rc: "", from: d.month + "-01", to: iso(new Date(y, m, 0)) }; return setTab("report"); }
      if (d.st !== undefined) { S.f.st = d.st; return render(); }
      if (d.reset !== undefined) { S.f = { st: "", q: "", grp: "", rc: "", from: "", to: "" }; return render(); }
      if (d.exp && !canExport) return;
      if (d.exp) { const list = filtered(); return d.exp === "xlsx" ? exportXlsx(list) : d.exp === "csv" ? exportCsv(list) : printReport(list); }
      if (d.cancel !== undefined) { S.pending = null; return render(); }
      if (d.commit) {
        const list = S.pending.list;
        const rows = d.commit === "replace" ? list : S.rows.filter((x) => !list.some((c) => c.emp === x.emp)).concat(list);
        b.disabled = true;
        try { await save(rows); S.pending = null; S.msg = "حُفظ السجل: " + rows.length + " بطاقة."; setTab("overview"); }
        catch (e) { S.msg = e.message; render(); }
      }
    });
    el.addEventListener("change", (ev) => {
      const t = ev.target, f = S.f;
      if (t.id === "saGrp") { f.grp = t.value; render(); } else if (t.id === "saRc") { f.rc = t.value; render(); }
      else if (t.id === "saFrom") { f.from = t.value; render(); } else if (t.id === "saTo") { f.to = t.value; render(); }
      else if (t.id === "saFile" && t.files[0]) {
        if (typeof XLSX === "undefined") { S.msg = "مكتبة Excel لم تُحمّل بعد."; return render(); }
        const r = new FileReader();
        r.onload = () => { try { S.pending = parseWorkbook(new Uint8Array(r.result)); S.msg = "راجع العدد ثم اعتمد."; } catch (e) { S.pending = null; S.msg = e.message; } render(); };
        r.readAsArrayBuffer(t.files[0]);
      }
    });
    el.addEventListener("input", (ev) => {
      if (ev.target.id !== "saQ") return;
      S.f.q = ev.target.value; render(); const i = el.querySelector("#saQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
    });
    el.addEventListener("submit", async (ev) => {
      if (ev.target.id !== "saForm") return; ev.preventDefault();
      const v = (id) => el.querySelector("#" + id).value.trim();
      const emp = v("fEmp"), exp = v("fExp"), old = S.rows.find((c) => c.emp === emp);
      if (!old && !v("fName")) { S.msg = "موظف جديد: اكتب الاسم."; return render(); }
      const c = old ? { ...old, exp, remark: v("fRem") || old.remark } : { emp, name: v("fName"), iqama: "", badge: "", sap: "", exp, remark: v("fRem") };
      try { await save(S.rows.filter((x) => x.emp !== emp).concat([c])); S.msg = (old ? "جُدّدت بطاقة " : "أُضيفت بطاقة ") + c.name + " حتى " + dmy(exp); } catch (e) { S.msg = e.message; }
      render();
    });

    load();
    return { reload: load };
  }

  window.SafetyApp = { mount, enrich, ST };
})();
