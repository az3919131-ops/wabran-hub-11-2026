/*
  دخول تلقائي من منصة الوبران: عند فتح المنصة داخل منصة الوبران تستلم رمز دخول المستخدم،
  وتطلب من البوابة جلسة «مشاهد» للقراءة فقط، ثم تبدأ المنصة والبيانات ظاهرة مباشرة بلا شاشة دخول.
  خارج منصة الوبران تعمل المنصة كما هي (دخول المحررين بحساباتهم).
*/
(function () {
  "use strict";
  var HUB = "https://wabran-najran-hub.netlify.app";
  var KEY = "sb-qcrzkqtorraegjtdpija-auth-token";
  var APP = "/assets/index-DzKJhSdy.js";
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    var s = document.createElement("script"); s.type = "module"; s.crossOrigin = ""; s.src = APP; document.head.appendChild(s);
  }
  function valid() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.access_token && (v.expires_at || 0) > Date.now() / 1000 + 120; } catch (e) { return false; }
  }
  var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (!framed || valid()) return boot();
  var t = setTimeout(boot, 6000);
  window.addEventListener("message", function (e) {
    if (e.origin !== HUB || !e.data || e.data.type !== "wabran-token" || !e.data.token || booted) return;
    fetch(HUB + "/api/wo-session", { headers: { authorization: "Bearer " + e.data.token }, mode: "cors" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.session) { try { localStorage.setItem(KEY, JSON.stringify(j.session)); } catch (x) {} } })
      .catch(function () {})
      .then(function () { clearTimeout(t); boot(); });
  });
  try { window.parent.postMessage({ type: "wabran-ready" }, HUB); } catch (e) {}
})();
