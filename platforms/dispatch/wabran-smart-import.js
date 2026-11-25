/*
  استيراد ذكي لجدول الأعمال اليومية: صورة (أو تصوير بالكاميرا) / PDF / نص حر
  ← يستخرج منصة الوبران الصفوف بالذكاء الاصطناعي ← تُراجع هنا ← تُدخل في نافذة «لصق من Excel»
  الخاصة بالمنصة فتمر بمعاينتها وفحوصها المعتادة قبل التنفيذ. لا يُكتب شيء دون تأكيدك.
*/
(function () {
  "use strict";
  var API = "https://wabran-najran-hub.netlify.app/api/edc-extract";
  var COLS = ["woNumber", "workType", "category", "contractor", "receiver", "mobile", "location", "mapsUrl", "coordsText", "voltage", "consultant", "notificationNo"];
  var HEAD = ["أمر عمل", "نوع العمل", "التصنيف", "المقاول", "المستلم", "الجوال", "الموقع", "رابط الموقع", "الإحداثيات", "الجهد", "الاستشاري", "رقم الإشعار"];
  var rows = [], notes = "";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var tok = function () { try { return localStorage.getItem("wabran_hub_token") || ""; } catch (e) { return ""; } };

  var css = ".wsi-btn{position:fixed;inset-inline-start:14px;bottom:66px;z-index:2147482990;background:#F37021;color:#fff;border:0;border-radius:99px;padding:9px 16px;font:600 14px 'IBM Plex Sans Arabic',Cairo,Tahoma,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer}" +
    ".wsi-btn:focus-visible{outline:3px solid #0F2537;outline-offset:2px}" +
    ".wsi-ov{position:fixed;inset:0;z-index:2147483100;background:rgba(15,37,55,.55);display:grid;place-items:center;padding:16px;direction:rtl;font-family:'IBM Plex Sans Arabic',Cairo,Tahoma,sans-serif}" +
    ".wsi-dlg{width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;color:#1E293B;border-radius:14px;border-top:4px solid #F37021;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.35)}" +
    ".wsi-dlg h2{margin:0 0 4px;font-size:20px}.wsi-dlg p{margin:0 0 12px;color:#475569;font-size:14px;line-height:1.7}" +
    ".wsi-in{display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px}.wsi-in label,.wsi-b{display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;cursor:pointer;font:600 14px inherit;background:#F8FAFC;color:#0F2537;text-align:center}" +
    ".wsi-in input[type=file]{position:absolute;width:1px;height:1px;opacity:0}.wsi-in textarea{width:100%;box-sizing:border-box;border:1px solid #E2E8F0;border-radius:10px;padding:8px;font:13px inherit;resize:vertical;min-height:84px}" +
    ".wsi-b.pri{background:#F37021;border-color:#F37021;color:#fff}.wsi-b:disabled{opacity:.5;cursor:default}" +
    ".wsi-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.wsi-msg{min-height:1.5em;margin:10px 0 0;font-size:14px;color:#0F2537}" +
    ".wsi-t{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:12px}.wsi-t th,.wsi-t td{border-bottom:1px solid #E2E8F0;padding:5px 6px;text-align:start;white-space:nowrap}.wsi-t th{background:#0F2537;color:#fff;font-weight:600}" +
    ".wsi-t tr.bad td{background:#FDE4E2}.wsi-tw{overflow:auto;max-height:42vh}.wsi-x{float:inline-end;background:none;border:0;font-size:22px;cursor:pointer;color:#475569}" +
    "@media(max-width:720px){.wsi-in{grid-template-columns:1fr 1fr}.wsi-in textarea{grid-column:1/-1}}@media print{.wsi-btn{display:none!important}}";

  function tsv() { return rows.map(function (r) { return COLS.map(function (k) { return String(r[k] == null ? "" : r[k]).replace(/[\t\r\n]+/g, " ").trim(); }).join("\t"); }).join("\n"); }
  function msg(t) { var m = document.getElementById("wsiMsg"); if (m) m.textContent = t; }

  function table() {
    if (!rows.length) return "";
    return '<div class="wsi-tw"><table class="wsi-t"><thead><tr><th>#</th>' + ["أمر عمل", "نوع العمل", "المستلم", "الجوال", "الموقع", "الجهد", "الاستشاري"].map(function (h) { return "<th>" + h + "</th>"; }).join("") + "<th></th></tr></thead><tbody>" +
      rows.map(function (r, i) { return '<tr class="' + (r.woNumber ? "" : "bad") + '"><td>' + (i + 1) + "</td>" + ["woNumber", "workType", "receiver", "mobile", "location", "voltage", "consultant"].map(function (k) { return "<td>" + esc(r[k]) + "</td>"; }).join("") + '<td><button type="button" class="wsi-b" data-del="' + i + '" aria-label="حذف الصف" style="padding:2px 8px">حذف</button></td></tr>'; }).join("") + "</tbody></table></div>";
  }
  function render() {
    var d = document.getElementById("wsiBody"); if (!d) return;
    d.innerHTML = table() + (notes ? '<p style="margin-top:8px">' + esc(notes) + "</p>" : "") +
      (rows.length ? '<div class="wsi-acts"><button class="wsi-b pri" type="button" id="wsiFill">إدخال في «لصق من Excel» للمعاينة والاستيراد</button><button class="wsi-b" type="button" id="wsiCopy">نسخ الصفوف</button><button class="wsi-b" type="button" id="wsiCsv">تصدير CSV</button><button class="wsi-b" type="button" id="wsiClear">مسح</button></div>' : "");
  }
  function b64(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(",")[1]); }; r.onerror = rej; r.readAsDataURL(f); }); }
  // تصغير الصور الكبيرة قبل الإرسال (صور الجوال)
  function shrink(f) {
    return new Promise(function (res) {
      if (!/^image\//.test(f.type) || f.size < 1.5e6) return b64(f).then(function (d) { res({ data: d, type: f.type }); });
      var img = new Image(), u = URL.createObjectURL(f);
      img.onload = function () { var s = Math.min(1, 2400 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res({ data: c.toDataURL("image/jpeg", 0.85).split(",")[1], type: "image/jpeg" }); };
      img.onerror = function () { b64(f).then(function (d) { res({ data: d, type: f.type }); }); };
      img.src = u;
    });
  }
  function extract(payload, label) {
    if (!tok()) { msg("سجّل الدخول بحساب منصة الوبران أولاً."); return; }
    msg("جارٍ استخراج الصفوف من " + label + "… (قد يستغرق دقيقة)");
    return fetch(API, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok() }, body: JSON.stringify(payload), mode: "cors" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error(x.j.error || "تعذّر الاستخراج");
        var got = (x.j.rows || []).filter(function (r) { return COLS.some(function (k) { return r[k]; }); });
        if (!got.length) throw new Error("لم أجد صفوف أوامر عمل في " + label);
        rows = rows.concat(got); notes = [x.j.date ? "تاريخ الجدول في المستند: " + x.j.date : "", x.j.notes, x.j.truncated ? "المستند طويل وقد لا تكون كل الصفوف استُخرجت؛ قسّمه." : ""].filter(Boolean).join(" · ");
        msg("استُخرج " + got.length + " صف. راجعها ثم أدخلها في «لصق من Excel»."); render();
      })
      .catch(function (e) { msg(e.message); });
  }
  function files(list) {
    var arr = Array.prototype.slice.call(list), p = Promise.resolve();
    arr.forEach(function (f) {
      p = p.then(function () {
        if (f.size > 8 * 1024 * 1024) { msg(f.name + " أكبر من 8 ميجابايت"); return; }
        if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) { if (f.size > 4 * 1024 * 1024) { msg("ملف PDF أكبر من 4 ميجابايت؛ قسّمه."); return; } return b64(f).then(function (d) { return extract({ kind: "pdf", data: d }, f.name); }); }
        if (/^image\//.test(f.type)) return shrink(f).then(function (s) { return extract({ kind: "image", media_type: s.type, data: s.data }, f.name || "الصورة"); });
        msg("نوع الملف غير مدعوم: " + f.name + " (لملفات Excel استخدم «الاستيراد والتصدير» في المنصة)");
      });
    });
  }
  function fill() {
    var text = tsv();
    try { navigator.clipboard && navigator.clipboard.writeText(text).catch(function () {}); } catch (e) {}
    var find = function () { return Array.prototype.slice.call(document.querySelectorAll("button")).find(function (b) { return /لصق من Excel/.test(b.textContent || ""); }); };
    var btn = find();
    if (!btn) {
      // نفتح صفحة «جدول الأعمال اليومية» ثم نضغط «لصق من Excel»
      msg("جارٍ فتح «جدول الأعمال اليومية»…"); location.hash = "#/edc/daily";
      var w = 0, tw = setInterval(function () { var b2 = find(); if (b2 || ++w > 50) { clearInterval(tw); if (b2) fill(); else msg("افتح «جدول الأعمال اليومية» ثم اضغط «لصق من Excel» والصق الصفوف (نُسخت للحافظة إن سمح المتصفح)."); } }, 100);
      return;
    }
    close(); btn.click();
    var n = 0, t = setInterval(function () {
      var ta = document.querySelector('textarea[aria-label="النص الملصق"]');
      if (ta || ++n > 40) {
        clearInterval(t);
        if (!ta) return;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, text);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
      }
    }, 100);
  }
  function csv() {
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var body = [HEAD.map(q).join(",")].concat(rows.map(function (r) { return COLS.map(function (k) { return q(r[k]); }).join(","); })).join("\r\n") + "\r\n\r\n" + q("Project Manager | Eng. Ahmed Zahran");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" })); a.download = "daily-jobs-extracted.csv"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function close() { var o = document.getElementById("wsiOv"); if (o) o.remove(); }
  function open() {
    close();
    var o = document.createElement("div"); o.id = "wsiOv"; o.className = "wsi-ov";
    o.innerHTML = '<div class="wsi-dlg" role="dialog" aria-modal="true" aria-labelledby="wsiT"><button class="wsi-x" type="button" id="wsiX" aria-label="إغلاق">×</button><h2 id="wsiT">استيراد جدول الأعمال من صورة أو PDF أو نص</h2>' +
      "<p>صوّر الجدول بالجوال أو أرفق صورة/PDF أو الصق نص الرسالة. تُستخرج الصفوف وتراجعها هنا، ثم تُدخل في نافذة «لصق من Excel» لتمر بمعاينة المنصة قبل التنفيذ. لملفات Excel استخدم «الاستيراد والتصدير».</p>" +
      '<div class="wsi-in"><label class="wsi-b pri">التقاط صورة<input type="file" accept="image/*" capture="environment" id="wsiCam"></label><label class="wsi-b">صورة أو PDF<input type="file" accept="image/*,application/pdf" multiple id="wsiFile"></label>' +
      '<div><textarea id="wsiTxt" placeholder="أو الصق هنا نصاً أو رسالة واتساب فيها أوامر العمل"></textarea><button class="wsi-b" type="button" id="wsiGoTxt" style="margin-top:6px;width:100%">استخراج من النص</button></div></div>' +
      '<p class="wsi-msg" id="wsiMsg" role="status"></p><div id="wsiBody"></div><p style="margin:12px 0 0;font-size:12px;text-align:center">Project Manager | Eng. Ahmed Zahran</p></div>';
    document.body.appendChild(o); render();
    o.addEventListener("click", function (e) {
      if (e.target === o || e.target.id === "wsiX") return close();
      var d = e.target.closest && e.target.closest("[data-del]"); if (d) { rows.splice(+d.dataset.del, 1); render(); return; }
      if (e.target.id === "wsiGoTxt") { var t = document.getElementById("wsiTxt").value.trim(); if (!t) return msg("الصق نصاً أولاً."); extract({ kind: "text", text: t }, "النص"); }
      if (e.target.id === "wsiFill") fill();
      if (e.target.id === "wsiCopy") { navigator.clipboard.writeText(tsv()).then(function () { msg("نُسخت الصفوف؛ الصقها في «لصق من Excel»."); }, function () { msg("المتصفح منع النسخ؛ استخدم «إدخال في لصق من Excel» أو «تصدير CSV»."); }); }
      if (e.target.id === "wsiCsv") csv();
      if (e.target.id === "wsiClear") { rows = []; notes = ""; msg(""); render(); }
    });
    o.addEventListener("change", function (e) { if (e.target.files && e.target.files.length) { files(e.target.files); e.target.value = ""; } });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
    document.getElementById("wsiCam").focus();
  }
  function mount() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement("button"); b.className = "wsi-btn"; b.type = "button"; b.textContent = "استيراد من صورة أو PDF"; b.addEventListener("click", open);
    document.body.appendChild(b);
  }
  function start() {
    var A = window.WabranAuth;
    if (!A || !A.ready) return mount();
    A.ready.then(function () { if (A.level === "edit") mount(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
