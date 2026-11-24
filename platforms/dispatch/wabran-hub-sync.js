/*
  مزامنة لوحة التوزيع اليومي مع منصة الوبران (wabran-najran-hub.netlify.app).
  لوحة التوزيع تحفظ بياناتها داخل متصفح المستخدم فقط؛ هذا الملف يقرأ آخر نسخة منها
  ويرفعها للقاعدة المشتركة للمنصة عند فتح اللوحة وكل دقيقة وعند إغلاقها، وفقط إن تغيّرت.
  يُرفع: جدول الأعمال اليومية (الكهرباء) لآخر 14 يوماً، وآخر 7 جداول توزيع للعمالة والمعدات.
  لا تُرفع المرفقات ولا كلمات المرور.
*/
(function () {
  "use strict";
  var HUB = "https://wabran-najran-hub.netlify.app/api/data?key=dispatch";
  var LAST = "wabran-hub-sync.last";

  function readLS(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

  function readEdc() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      var req;
      try { req = indexedDB.open("wabran-edc"); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () { try { req.transaction.abort(); } catch (e) {} resolve(null); };
      req.onerror = function () { resolve(null); };
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("kv")) { db.close(); return resolve(null); }
        var g = db.transaction("kv", "readonly").objectStore("kv").get("data");
        g.onsuccess = function () { db.close(); resolve(g.result || null); };
        g.onerror = function () { db.close(); resolve(null); };
      };
    });
  }

  // نفس بناء صفوف «جدول الأعمال اليومية» المطبوع في اللوحة
  function edcDays(d) {
    if (!d || !d.activities) return [];
    var name = function (list, id) { var x = (list || []).find(function (e) { return e.id === id; }); return x ? x.name : ""; };
    var statusOf = function (code) { var s = ((d.settings && d.settings.statuses) || []).find(function (e) { return e.code === code; }); return s ? s.label : code || ""; };
    var wos = new Map((d.workOrders || []).map(function (w) { return [w.id, w]; }));
    var dates = Array.from(new Set(d.activities.filter(function (a) { return !a.deletedAt; }).map(function (a) { return a.date; }))).sort().reverse().slice(0, 14);
    var dayInfo = new Map((d.days || []).map(function (x) { return [x.date, x]; }));
    return dates.map(function (date) {
      var acts = d.activities.filter(function (a) { var w = wos.get(a.workOrderId); return a.date === date && !a.deletedAt && w && !w.deletedAt; })
        .sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
      var info = dayInfo.get(date) || {};
      return {
        date: date, state: info.state || "", version: info.version || null,
        rows: acts.map(function (a, i) {
          var w = wos.get(a.workOrderId);
          return { seq: i + 1, woNumber: w.woNumber || "", workType: a.description || w.workType || "", category: w.category || "", contractor: name(d.contractors, w.contractorId),
            receiver: name(d.receivers, a.receiverId), mobile: a.mobile || "", location: w.location || "", mapsUrl: w.mapsUrl || "", coordsText: w.coordsText || "",
            voltage: w.voltage || "", consultant: name(d.consultants, a.consultantId), notificationNo: w.notificationNo || "",
            status: statusOf(a.status), statusCode: a.status || "", progress: a.progress == null ? null : a.progress, notes: a.notes || "", delayReason: a.delayReason || "", priority: w.priority || "" };
        })
      };
    });
  }

  function dispatchPlans() {
    var res = readLS("ndb.v1.resources"), plans = readLS("ndb.v1.plans");
    if (!res || !plans) return [];
    var emp = new Map((res.employees || []).map(function (e) { return [e.id, e]; }));
    var veh = new Map((res.vehicles || []).map(function (e) { return [e.id, e]; }));
    var loc = new Map((res.locations || []).map(function (e) { return [e.id, e]; }));
    var prof = new Map((res.professions || []).map(function (e) { return [e.code, e.labelAr || e.labelEn]; }));
    var en = function (e) { return e ? ((e.shortName && e.shortName.trim()) || e.fullName || "") : ""; };
    return Object.values(plans).filter(function (p) { return p && p.date; }).sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 7).map(function (p) {
      var ids = [];
      (p.sites || []).forEach(function (s) { ids.push(s.locationId); });
      (p.vehicles || []).concat(p.team || []).forEach(function (x) { if (ids.indexOf(x.locationId) < 0) ids.push(x.locationId); });
      return {
        date: p.date, status: p.status || "",
        sites: ids.map(function (id) {
          var l = loc.get(id) || {}, s = (p.sites || []).find(function (x) { return x.locationId === id; }) || {};
          return {
            name: l.nameAr || l.nameEn || "—", kind: l.kind || "", workType: s.workType || "", note: s.note || "",
            vehicles: (p.vehicles || []).filter(function (v) { return v.locationId === id; }).map(function (v) { var x = veh.get(v.vehicleId) || {}, d = emp.get(v.driverId); return { fleetNo: x.fleetNo || "", category: x.category || "", plate: x.plate || "", driver: en(d), driverNo: d ? d.empNo || d.employeeNo || "" : "", remark: v.remark || "" }; }),
            team: (p.team || []).filter(function (t) { return t.locationId === id; }).map(function (t) { var e = emp.get(t.employeeId) || {}; return { name: en(e), empNo: e.empNo || e.employeeNo || "", profession: prof.get(e.professionCode) || e.professionCode || "", role: t.role || "", phone: e.phone || e.mobile || "" }; })
          };
        }).filter(function (s) { return s.vehicles.length || s.team.length || s.workType || s.note; })
      };
    });
  }

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return String(h); }

  var busy = false;
  async function sync(final) {
    if (busy) return; busy = true;
    try {
      var edc = edcDays(await readEdc());
      var plans = dispatchPlans();
      if (!edc.length && !plans.length) return;
      var body = { source: location.host, edc: edc, plans: plans };
      var s = JSON.stringify(body), h = hash(s);
      if (sessionStorage.getItem(LAST) === h) return;
      body.syncedAt = new Date().toISOString();
      var r = await fetch(HUB, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: !!final, mode: "cors" });
      if (r.ok) sessionStorage.setItem(LAST, h);
    } catch (e) { /* المزامنة لا تؤثر على عمل اللوحة */ }
    finally { busy = false; }
  }

  setTimeout(sync, 4000);
  setInterval(sync, 60000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") sync(true); });
  window.addEventListener("pagehide", function () { sync(true); });
})();
