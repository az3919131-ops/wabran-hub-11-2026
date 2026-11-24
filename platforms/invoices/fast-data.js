/*
  تسريع عرض منصة الفواتير (خاصة داخل منصة الوبران):
  1) طلبات قاعدة البيانات تمر عبر نطاق المنصة نفسها (/sb/ ← Supabase) فلا تتأثر بحجب نطاق supabase.co.
  2) قراءات العرض العام (بدون دخول المحررين) تُحفظ نسخة منها في المتصفح؛ إن تأخرت الشبكة أكثر من ثانية
     تظهر آخر نسخة فوراً، ويكتمل الطلب في الخلفية ليُحدّث النسخة للمرة القادمة.
  لا يغيّر أي بيانات ولا صلاحيات؛ الكتابة والدخول تمر كما هي.
*/
(function () {
  "use strict";
  var SB = "https://kvzoiqlhtqdqliedhzie.supabase.co/";
  var ANON = "sb_publishable_KStD4XDTSN_Bw3AQK7iQoQ_ENSqWE2v";
  var PROXY = location.origin + "/sb/";
  var WAIT = 1000;
  var orig = window.fetch.bind(window);
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try { var r = indexedDB.open("inv-fast", 1); r.onupgradeneeded = function () { r.result.createObjectStore("c"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; }
      catch (e) { res(null); }
    });
    return dbp;
  }
  function cget(k) { return db().then(function (d) { return d ? new Promise(function (res) { try { var q = d.transaction("c").objectStore("c").get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }) : null; }); }
  function cput(k, v) { db().then(function (d) { try { if (d) d.transaction("c", "readwrite").objectStore("c").put(v, k); } catch (e) {} }); }
  function hdr(init, req, n) { try { var h = new Headers((init && init.headers) || (req && req.headers) || {}); return h.get(n) || ""; } catch (e) { return ""; } }

  window.fetch = function (input, init) {
    var req = input instanceof Request ? input : null;
    var url = req ? req.url : String(input);
    if (url.indexOf(SB) !== 0) return orig(input, init);
    var nurl = PROXY + url.slice(SB.length);
    var method = ((init && init.method) || (req && req.method) || "GET").toUpperCase();
    var call = function () { if (req) return orig(new Request(nurl, req), init); return orig(nurl, init); };
    var auth = hdr(init, req, "authorization");
    var isRead = method === "GET" && url.indexOf(SB + "rest/v1/") === 0 && (!auth || auth === "Bearer " + ANON);
    if (!isRead) return call();
    var key = url;
    var net = call().then(function (r) {
      if (r.ok) r.clone().text().then(function (t) { cput(key, { t: t, s: r.status, h: [["content-type", r.headers.get("content-type") || "application/json"], ["content-range", r.headers.get("content-range") || ""]], at: Date.now() }); });
      return r;
    });
    return Promise.race([
      net,
      new Promise(function (res) { setTimeout(res, WAIT); }).then(function () { return cget(key); }).then(function (c) {
        if (!c) return net;
        var h = new Headers(); c.h.forEach(function (x) { if (x[1]) h.set(x[0], x[1]); });
        return new Response(c.t, { status: c.s, headers: h });
      }),
    ]).catch(function () { return cget(key).then(function (c) { if (!c) throw new TypeError("Failed to fetch"); var h = new Headers(); c.h.forEach(function (x) { if (x[1]) h.set(x[0], x[1]); }); return new Response(c.t, { status: c.s, headers: h }); }); });
  };
})();
