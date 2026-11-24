/*
  مزامنة «منصة تقدم الأعمال» (جدول الأعمال اليومي والشهري) مع منصة الوبران.
  بيانات هذه المنصة تُحفظ داخل المتصفح (الأساس + ما تستورده من Excel)، لذلك يرفع هذا الملف
  آخر نسخة كاملة إلى القاعدة المشتركة عند فتح المنصة، وكل دقيقة، وعند إغلاقها — وفقط إن تغيّرت.
  الأرقام الشهرية تُحسب بدوال المنصة نفسها (Calc و App.helpers) فتطابق صفحة «التحليل الشهري» تماماً.
*/
(function () {
  "use strict";
  var HUB = "https://wabran-najran-hub.netlify.app/api/data?key=ds_schedule";
  var LAST = "wabran-hub-sync.schedule";

  function build() {
    var App = window.App, C = window.Calc;
    if (!App || !C || !App.rows || !App.rows.length) return null;
    var all = App.rows.filter(function (r) { return r.date; });
    if (!all.length) return null;
    // نفس أساس الخطة في المنصة (بدون فلاتر العرض)
    var aggAll = C.aggregate(all), ds = aggAll.dailySeries;
    var avg90 = ds.length ? ds.slice(-90).reduce(function (a, b) { return a + b.value; }, 0) / Math.min(90, ds.length) : null;
    var st = App.settings || {};
    var base = { avgDaily: st.mode === "avg90" ? avg90 : aggAll.avgDaily, monthTargets: st.monthTargets || {}, mode: st.mode };
    var planned = function (d) { return C.plannedDaily(d, base) || 0; };
    var lastDate = ds.length ? ds[ds.length - 1].date : null;

    var months = aggAll.monthlySeries.map(function (x) {
      var ym = x.month, rows = all.filter(function (r) { return r._ym === ym; }), agg = C.aggregate(rows), m = agg.monthlySeries[0] || { value: 0, days: 0, avg: null, count: 0 };
      var pAvg = planned(ym + "-01"), pTot = pAvg * m.days, dim = C.daysInMonth(ym);
      var bad = agg.dailySeries.filter(function (d) { return C.perfStatus(d.value, planned(d.date)) === "bad"; });
      var miss = C.missingDays(agg.dailySeries.map(function (d) { return d.date; }), ym + "-01", ym + "-" + String(dim).padStart(2, "0"));
      var loc = C.sumBy(rows, function (r) { return (r.location || "").trim() || "غير محدد"; }, function (r) { return r.total; });
      var act = C.sumBy(rows, function (r) { return r.item_code; }, function (r) { return r.total; });
      var tgt = (base.monthTargets || {})[ym] || null;
      return {
        ym: ym, value: m.value, days: m.days, avg: m.avg, count: m.count || rows.length,
        planAvg: pAvg, plan: pTot, status: C.perfStatus(m.value, pTot), avgStatus: C.perfStatus(m.avg, pAvg),
        bad: bad.length, missing: miss, target: tgt,
        daily: agg.dailySeries.map(function (d) { return { date: d.date, value: d.value, plan: planned(d.date), status: C.perfStatus(d.value, planned(d.date)) }; }),
        byLoc: Array.from(loc.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12),
        byItem: Array.from(act.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12),
      };
    });
    // صفوف يوم × موقع لمحرك تحليل البوابة (نفس صيغة المزامنة السابقة)
    var m2 = new Map(), lastD = "", locF = "";
    all.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (r) {
      if (r.date !== lastD) { lastD = r.date; locF = ""; }
      if (r.location && String(r.location).trim()) locF = String(r.location).trim();
      var site = locF || "غير محدد", k = r.date + "|" + site;
      if (!m2.has(k)) m2.set(k, { date: r.date, site: site, items: 0, value: 0, status: "منفذ" });
      var g = m2.get(k); g.items += 1; g.value += Number(r.total) || 0;
    });
    var rows = Array.from(m2.values()).map(function (g) { g.value = Math.round(g.value); return g; });
    return {
      asof: lastDate, source: "najran-wabran-dor-dashboard", items: App.rows.length, rows: rows,
      monthly: { lastDate: lastDate, firstDate: ds.length ? ds[0].date : null, avgDaily: aggAll.avgDaily, avg90: avg90, mode: base.mode || "avg", months: months },
    };
  }

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
  function status(t) { try { var el = document.getElementById("wbn-sync"); if (el) el.textContent = t; } catch (e) {} }

  var busy = false;
  async function sync(final) {
    if (busy) return; busy = true;
    try {
      var tok = ""; try { tok = localStorage.getItem("wabran_hub_token") || ""; } catch (e) {}
      if (!tok) return; // المزامنة بعد الدخول بحساب منصة الوبران
      var body = build(); if (!body) return;
      var s = JSON.stringify(body), h = hash(s);
      if (sessionStorage.getItem(LAST) === h) return;
      body.syncedAt = new Date().toISOString();
      var r = await fetch(HUB, { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify(body), keepalive: !!final && s.length < 60000, mode: "cors" });
      if (r.ok) { sessionStorage.setItem(LAST, h); status("تمت مزامنة منصة الوبران حتى " + body.asof); }
    } catch (e) { /* المزامنة لا تؤثر على عمل المنصة */ }
    finally { busy = false; }
  }
  window.WabranScheduleSync = { build: build, sync: sync };
  function start() { var go = function () { sync(); }; if (window.WabranAuth && window.WabranAuth.ready) window.WabranAuth.ready.then(function () { setTimeout(go, 1500); }); setTimeout(go, 6000); setInterval(go, 60000); }
  start();
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") sync(true); });
})();
