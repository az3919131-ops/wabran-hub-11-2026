/*
  ربط المنصة بمنصة الوبران الرئيسية: زر عائم «رجوع لمنصة الوبران» وقائمة بالمنصات الأخرى.
  يُضاف بسطر واحد في index.html:  <script src="/wabran-nav.js" data-platform="licenses" defer></script>
  لا يظهر عند عرض المنصة داخل منصة الوبران نفسها (داخل إطار) حتى لا يتكرر الشريط.
*/
(function () {
  "use strict";
  if (window.self !== window.top) return;
  var HUB = "https://wabran-najran-hub.netlify.app/";
  var me = (document.currentScript && document.currentScript.getAttribute("data-platform")) || "";
  var P = [
    ["projects", "منصة مستهدف الإنشاءات والمشاريع"],
    ["schedule", "جدول الأعمال اليومي والشهري"],
    ["invoices", "تحليل الفواتير الضريبية"],
    ["assign", "تحليل إسناد أوامر العمل"],
    ["dispatch", "تخطيط العمل اليومي"],
    ["licenses", "موقف الرخص"],
    ["safety", "بطاقات السلامة"]
  ];
  var css = ".wbn{position:fixed;inset-inline-start:14px;bottom:14px;z-index:2147483000;font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;direction:rtl}" +
    ".wbn-btn{display:flex;align-items:center;gap:8px;background:#13262F;color:#E9EFEC;border:2px solid #E3A21A;border-radius:99px;padding:8px 16px;font:600 14px inherit;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);text-decoration:none}" +
    ".wbn-btn:focus-visible,.wbn a:focus-visible{outline:3px solid #E3A21A;outline-offset:2px}" +
    ".wbn-menu{position:absolute;bottom:52px;inset-inline-start:0;min-width:270px;background:#fff;color:#13262F;border:1px solid #D3DAD7;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:8px;display:none}" +
    ".wbn.open .wbn-menu{display:block}" +
    ".wbn-menu a{display:block;padding:8px 10px;border-radius:8px;color:#13262F;text-decoration:none;font-size:14px}" +
    ".wbn-menu a:hover{background:#EEF1EF}" +
    ".wbn-menu .home{background:#13262F;color:#fff;font-weight:700;margin-bottom:6px}" +
    ".wbn-menu .home:hover{background:#1D3540}" +
    ".wbn-menu small{display:block;color:#56686D;font-size:12px;padding:4px 10px}" +
    ".wbn-menu .cur{font-weight:700;background:#FAEBCB}" +
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
