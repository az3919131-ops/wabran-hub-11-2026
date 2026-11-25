/*
  ربط المنصة بمنصة الوبران الرئيسية: زر عائم «رجوع لمنصة الوبران» وقائمة بالمنصات الأخرى.
  يُضاف بسطر واحد في index.html:  <script src="/wabran-nav.js" data-platform="licenses" defer></script>
  لا يظهر عند عرض المنصة داخل منصة الوبران نفسها (داخل إطار) حتى لا يتكرر الشريط.
*/
(function () {
  "use strict";
  var HUB = "https://wabran-najran-hub.netlify.app/";
  var API = HUB + "api/auth/";
  var TK = "wabran_hub_token";
  var me = (document.currentScript && document.currentScript.getAttribute("data-platform")) || "";
  var framed = window.self !== window.top;
  var P = [
    ["bigprojects", "منصة المشاريع الكبيرة"],
    ["projects", "منصة مستهدف الإنشاءات والمشاريع"],
    ["schedule", "جدول الأعمال اليومي والشهري"],
    ["invoices", "تحليل الفواتير الضريبية"],
    ["assign", "تحليل إسناد أوامر العمل"],
    ["dispatch", "تخطيط العمل اليومي"],
    ["licenses", "موقف الرخص"],
    ["safety", "بطاقات السلامة"]
  ];
  var LS = { get: function (k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: function (k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} } };

  /* ---------- الدخول الموحد: نفس حساب منصة الوبران ---------- */
  var resolveReady;
  var Auth = window.WabranAuth = {
    user: null,
    ready: new Promise(function (r) { resolveReady = r; }),
    headers: function () { var t = LS.get(TK); return t ? { authorization: "Bearer " + t } : {}; },
    logout: function () { LS.set(TK, ""); location.reload(); }
  };
  var css0 = ".wbn-gate{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:16px;background:linear-gradient(160deg,#0B1D2D,#0F2537 55%,#1B3550);font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;direction:rtl}" +
    ".wbn-card{width:min(400px,100%);background:#fff;color:#1E293B;border-radius:14px;padding:24px;border-top:4px solid #F37021;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
    ".wbn-card h2{margin:0 0 4px;font-size:20px}.wbn-logo{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-weight:700}.wbn-logo img{width:42px;height:auto;border-radius:9px}.wbn-logo span{display:block;font-weight:400;font-size:12px;color:#9A6E44}.wbn-card p{margin:0 0 14px;color:#56686D;font-size:14px}" +
    ".wbn-card label{display:grid;gap:4px;font-size:13px;color:#56686D;margin-bottom:10px}.wbn-card input{padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-size:15px;direction:ltr}.wbn-card input:focus{border-color:#F37021;outline:2px solid rgba(243,112,33,.25)}" +
    ".wbn-card button,.wbn-card a.b{display:block;width:100%;text-align:center;padding:10px;border:0;border-radius:8px;background:#F37021;color:#fff;font:600 15px inherit;cursor:pointer;text-decoration:none;margin-top:6px}" +
    ".wbn-card .m{min-height:1.4em;color:#B8332A;font-size:14px;margin-top:8px}.wbn-card small{display:block;text-align:center;margin-top:12px;color:#56686D;direction:ltr}" +
    ".wbn-card .lnk{background:none;color:#56686D;text-decoration:underline;font-weight:400;font-size:13px}";
  var st0 = document.createElement("style"); st0.textContent = css0; (document.head || document.documentElement).appendChild(st0);
  function gate(html) {
    var g = document.getElementById("wbnGate");
    if (!g) { g = document.createElement("div"); g.id = "wbnGate"; g.className = "wbn-gate"; (document.body || document.documentElement).appendChild(g); }
    g.innerHTML = '<div class="wbn-card"><div class="wbn-logo"><img src="' + HUB + 'img/wabran-logo.png" alt=""><div>منصة الوبران · نجران<span>مشاريع قطاع الطاقة</span></div></div>' + html + '<small>Project Manager | Eng. Ahmed Zahran</small></div>';
    return g;
  }
  function closeGate() { var g = document.getElementById("wbnGate"); if (g) g.remove(); }
  function title() { var x = P.find(function (p) { return p[0] === me; }); return x ? x[1] : "منصة الوبران"; }
  function showLogin(msg) {
    var g = gate('<h2>تسجيل الدخول</h2><p>' + title() + ' — ادخل بحساب منصة الوبران الموحد.</p><form id="wbnLf"><label>البريد الإلكتروني<input type="email" id="wbnE" required autocomplete="username"></label><label>كلمة المرور<input type="password" id="wbnP" required autocomplete="current-password"></label><button type="submit">دخول</button></form><div class="m" id="wbnM">' + (msg || "") + '</div><a class="b lnk" href="' + HUB + '">نسيت كلمة المرور؟ استرجعها من منصة الوبران</a>');
    g.querySelector("#wbnLf").addEventListener("submit", function (e) {
      e.preventDefault(); var m = g.querySelector("#wbnM"); m.textContent = "جارٍ الدخول…";
      fetch(API + "login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: g.querySelector("#wbnE").value, password: g.querySelector("#wbnP").value }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) { if (!x.ok) { m.textContent = x.j.error || "تعذّر الدخول"; return; } LS.set(TK, x.j.token); accept(x.j.user); })
        .catch(function () { m.textContent = "تعذّر الاتصال بمنصة الوبران"; });
    });
  }
  function accept(u) {
    var lv = u.access && u.access[me] || "none";
    if (me && lv === "none") { gate('<h2>لا تملك صلاحية على هذه المنصة</h2><p>حسابك (' + u.email + ') لا يملك وصولاً إلى «' + title() + '». اطلب الصلاحية من مدير النظام.</p><a class="b" href="' + HUB + '">الرجوع لمنصة الوبران</a><button type="button" class="lnk" id="wbnOut">تسجيل الخروج</button>'); document.getElementById("wbnOut").onclick = Auth.logout; return; }
    Auth.user = u; Auth.level = lv; closeGate(); resolveReady(u);
  }
  function check() {
    var t = LS.get(TK);
    if (!t) return showLogin();
    fetch(API + "me", { headers: { authorization: "Bearer " + t } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { if (x.ok) accept(x.j.user); else { LS.set(TK, ""); showLogin("انتهت الجلسة، سجّل الدخول مجدداً."); } })
      .catch(function () { showLogin("تعذّر الاتصال بمنصة الوبران"); });
  }
  // داخل منصة الوبران: تستلم المنصة رمز الدخول من الإطار الأب فلا يُطلب الدخول مرة ثانية
  if (framed) {
    var got = false;
    window.addEventListener("message", function (e) {
      if (e.origin !== HUB.slice(0, -1) || !e.data || e.data.type !== "wabran-token") return;
      got = true; LS.set(TK, e.data.token); check();
    });
    try { window.parent.postMessage({ type: "wabran-ready" }, HUB.slice(0, -1)); } catch (e) {}
    setTimeout(function () { if (!got) check(); }, 2500);
  } else {
    if (document.body) check(); else document.addEventListener("DOMContentLoaded", check);
  }
  if (framed) return;
  var css = ".wbn{position:fixed;inset-inline-start:14px;bottom:14px;z-index:2147483000;font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;direction:rtl}" +
    ".wbn-btn{display:flex;align-items:center;gap:8px;background:#0F2537;color:#EEF2F6;border:2px solid #F37021;border-radius:99px;padding:8px 16px;font:600 14px inherit;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);text-decoration:none}" +
    ".wbn-btn:focus-visible,.wbn a:focus-visible{outline:3px solid #F37021;outline-offset:2px}" +
    ".wbn-menu{position:absolute;bottom:52px;inset-inline-start:0;min-width:270px;background:#fff;color:#13262F;border:1px solid #D3DAD7;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:8px;display:none}" +
    ".wbn.open .wbn-menu{display:block}" +
    ".wbn-menu a{display:block;padding:8px 10px;border-radius:8px;color:#13262F;text-decoration:none;font-size:14px}" +
    ".wbn-menu a:hover{background:#EEF1EF}" +
    ".wbn-menu .home{background:#0F2537;color:#fff;font-weight:700;margin-bottom:6px}" +
    ".wbn-menu .home:hover{background:#1A3550}" +
    ".wbn-menu small{display:block;color:#56686D;font-size:12px;padding:4px 10px}" +
    ".wbn-menu .cur{font-weight:700;background:#FDE9DC}" +
    "@media print{.wbn{display:none!important}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var box = document.createElement("div"); box.className = "wbn";
  var items = P.map(function (p) {
    return '<a href="' + HUB + (p[0] === me ? "#/app/" + p[0] : "#/go/" + p[0]) + '"' + (p[0] === me ? ' class="cur"' : "") + ">" + p[1] + (p[0] === me ? " — تحليلها في المنصة" : "") + "</a>";
  }).join("");
  box.innerHTML = '<div class="wbn-menu" role="menu"><a class="home" href="' + HUB + '#/">→ الصفحة الرئيسية لمنصة الوبران</a><small>المنصات</small>' + items + "</div>" +
    '<button class="wbn-btn" type="button" aria-haspopup="true" aria-expanded="false">→ منصة الوبران</button>';
  function mount() { document.body.appendChild(box); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  var btn = box.querySelector(".wbn-btn");
  btn.addEventListener("click", function (e) { e.stopPropagation(); var o = box.classList.toggle("open"); btn.setAttribute("aria-expanded", String(o)); });
  document.addEventListener("click", function (e) { if (!box.contains(e.target)) { box.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { box.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
})();
