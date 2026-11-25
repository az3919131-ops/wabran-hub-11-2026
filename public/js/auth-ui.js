/* الدخول الموحد وإدارة المستخدمين والصلاحيات (على غرار لوحة إدارة الحسابات في منصة التزام). */
(function () {
  "use strict";
  const { U, Auth } = HUB;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LV = { none: "بلا وصول", view: "عرض فقط", export: "عرض وتصدير", edit: "تعديل" };
  const CAPL = { assistant: "المساعد الذكي", sync: "مزامنة المنصات", users: "إدارة المستخدمين" };
  let META = null;

  async function api(path, opt = {}) {
    const r = await fetch(path, { ...opt, headers: { "content-type": "application/json", ...Auth.headers(), ...(opt.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || "تعذّر الاتصال (" + r.status + ")"); e.status = r.status; throw e; }
    return j;
  }
  async function meta() { return META || (META = await api("/api/auth/meta")); }

  /* ---------- شاشة الدخول / النسيان / التعيين ---------- */
  function screen(inner) {
    let el = document.getElementById("authScreen");
    if (!el) { el = document.createElement("div"); el.id = "authScreen"; el.className = "auth-screen"; el.setAttribute("dir", "rtl"); document.body.appendChild(el); }
    document.body.classList.add("auth-mode");
    el.innerHTML = `<div class="auth-wrap"><aside class="auth-art">${window.NJ ? NJ.scene("auth", "start") : ""}<div class="auth-art-text"><img src="img/wabran-logo.png" alt="" width="72" height="62"><h2>شركة ناصر مانع الوبران وشركاه</h2><p>مقاول مشاريع الشركة السعودية للكهرباء في نجران: أوامر العمل، والتخطيط اليومي، والرخص، والسلامة في منصة واحدة.</p></div></aside>
      <main class="auth-card"><div class="auth-brand"><img src="img/wabran-logo.png" alt="شعار الوبران" width="44" height="38"><div><b>منصة الوبران · نجران</b><span>مشاريع قطاع الطاقة</span></div></div>${inner}<p class="auth-sign">Project Manager | Eng. Ahmed Zahran</p></main></div>`;
    return el;
  }
  function closeScreen() { const el = document.getElementById("authScreen"); if (el) el.remove(); document.body.classList.remove("auth-mode"); }

  function loginForm(msg) {
    const el = screen(`<h1>تسجيل الدخول</h1><p class="auth-sub">حساب واحد لكل منصات الوبران.</p>
      <form id="loginForm" class="auth-form"><label>البريد الإلكتروني<input type="email" id="lgEmail" autocomplete="username" required dir="ltr"></label>
      <label>كلمة المرور<input type="password" id="lgPw" autocomplete="current-password" required dir="ltr"></label>
      <button class="btn pri" type="submit">دخول</button></form>
      <p class="auth-msg ${msg && msg.err ? "err" : ""}" id="lgMsg" role="status">${esc(msg ? msg.text : "")}</p>
      <button class="auth-link" type="button" id="lgForgot">نسيت كلمة المرور؟</button>`);
    el.querySelector("#lgEmail").focus();
    el.querySelector("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const m = el.querySelector("#lgMsg"); m.className = "auth-msg"; m.textContent = "جارٍ الدخول…";
      try {
        const j = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: el.querySelector("#lgEmail").value, password: el.querySelector("#lgPw").value }) });
        Auth.token = j.token; location.hash = "#/"; location.reload();
      } catch (err) { m.className = "auth-msg err"; m.textContent = err.message; }
    });
    el.querySelector("#lgForgot").addEventListener("click", forgotForm);
  }
  function forgotForm() {
    const el = screen(`<h1>استرجاع كلمة المرور</h1><p class="auth-sub">اكتب بريد حسابك، وسيصلك رابط لتعيين كلمة مرور جديدة.</p>
      <form id="fgForm" class="auth-form"><label>البريد الإلكتروني<input type="email" id="fgEmail" required dir="ltr"></label><button class="btn pri" type="submit">إرسال رابط الاسترجاع</button></form>
      <p class="auth-msg" id="fgMsg" role="status"></p><button class="auth-link" type="button" id="fgBack">الرجوع لتسجيل الدخول</button>`);
    el.querySelector("#fgEmail").focus();
    el.querySelector("#fgBack").addEventListener("click", () => loginForm());
    el.querySelector("#fgForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const m = el.querySelector("#fgMsg"); m.className = "auth-msg"; m.textContent = "جارٍ الإرسال…";
      try { const j = await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email: el.querySelector("#fgEmail").value }) }); m.className = "auth-msg ok"; m.textContent = j.message; }
      catch (err) { m.className = "auth-msg err"; m.textContent = err.message; }
    });
  }
  function resetForm(token) {
    const el = screen(`<h1>تعيين كلمة مرور جديدة</h1>
      <form id="rsForm" class="auth-form"><label>كلمة المرور الجديدة<input type="password" id="rsPw" minlength="6" required dir="ltr" autocomplete="new-password"></label>
      <label>تأكيد كلمة المرور<input type="password" id="rsPw2" minlength="6" required dir="ltr" autocomplete="new-password"></label><button class="btn pri" type="submit">حفظ والدخول</button></form>
      <p class="auth-msg" id="rsMsg" role="status"></p>`);
    el.querySelector("#rsForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const m = el.querySelector("#rsMsg");
      if (el.querySelector("#rsPw").value !== el.querySelector("#rsPw2").value) { m.className = "auth-msg err"; m.textContent = "كلمتا المرور غير متطابقتين"; return; }
      try { const j = await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password: el.querySelector("#rsPw").value }) }); Auth.token = j.token; location.hash = "#/"; location.reload(); }
      catch (err) { m.className = "auth-msg err"; m.textContent = err.message; }
    });
  }

  // تُستدعى عند الإقلاع: ترجع المستخدم، أو تعرض شاشة الدخول وترجع null
  async function ensure() {
    const h = location.hash.match(/^#\/reset\/([a-f0-9]{64})$/);
    if (h) { resetForm(h[1]); return null; }
    if (!Auth.token) { loginForm(); return null; }
    try { const j = await api("/api/auth/me"); HUB.user = j.user; closeScreen(); return j.user; }
    catch (e) { if (e.status === 401) { Auth.token = ""; loginForm({ text: "انتهت الجلسة، سجّل الدخول مجدداً." }); return null; } throw e; }
  }
  function logout() { Auth.token = ""; ["ds_bigprojects", "ds_projects", "ds_schedule", "ds_invoices", "ds_assign", "licenses", "cards", "dispatch", "summary", "snapshots"].forEach((k) => U.ls.set(k, null)); location.hash = "#/"; location.reload(); }
  Auth.onExpired = () => { if (!document.getElementById("authScreen")) { Auth.token = ""; loginForm({ text: "انتهت الجلسة، سجّل الدخول مجدداً." }); } };

  /* ---------- لوحة إدارة الحسابات والصلاحيات ---------- */
  const state = { users: [], edit: null, q: "", msg: "" };
  async function usersPanel(root) {
    const M = await meta();
    root.innerHTML = '<div class="empty">جارٍ تحميل الحسابات…</div>';
    try { state.users = (await api("/api/users")).users; } catch (e) { root.innerHTML = `<div class="note">${esc(e.message)}</div>`; return; }
    const names = Object.fromEntries(REGISTRY_ALL.map((p) => [p.id, p.name]));
    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const list = state.users.filter((u) => !q || (u.name + " " + u.email + " " + u.roleLabel).toLowerCase().includes(q));
      const cnt = (u) => Object.values(u.access).filter((v) => v !== "none").length;
      root.innerHTML = `
        <div class="panel"><div class="exp-bar" style="margin:0;padding:0;border:0"><span><b>الحسابات</b> <span class="count">${state.users.length}</span></span>
          <span class="exp-btns"><input type="search" id="usQ" placeholder="بحث بالاسم أو البريد" value="${esc(state.q)}" style="width:220px"><button class="btn pri sm" type="button" data-unew>إضافة مستخدم</button></span></div>
          <p class="msg ${state.msgErr ? "err" : "ok"}" role="status">${esc(state.msg)}</p>
          <div class="tbl"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المنصات</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody>
          ${list.map((u) => `<tr><td>${esc(u.name)}${u.id === HUB.user.id ? ' <span class="pill p-ok">أنت</span>' : ""}</td><td class="ltr">${esc(u.email)}</td><td>${esc(u.roleLabel)}</td><td class="num">${cnt(u)} من ${M.platforms.length}</td><td>${u.active ? '<span class="pill p-ok">مفعّل</span>' : '<span class="pill p-none">موقوف</span>'}</td><td class="num">${u.lastLogin ? esc(new Date(u.lastLogin).toLocaleString("ar-SA-u-nu-latn")) : "—"}</td><td><button class="btn sm" type="button" data-uedit="${u.id}">تعديل الصلاحيات</button></td></tr>`).join("")}
          </tbody></table></div></div>
        ${state.edit ? editor(state.edit, M, names) : ""}`;
    };
    const editor = (u, M, names) => {
      const isNew = !u.id, isAdmin = u.role === "admin", self = u.id === HUB.user.id;
      return `<div class="panel section" id="uEditor"><h3>${isNew ? "مستخدم جديد" : "صلاحيات " + esc(u.name)}</h3>
        <div class="form">
          <label class="f">الاسم<input id="ueName" value="${esc(u.name || "")}"></label>
          <label class="f">البريد الإلكتروني<input id="ueEmail" type="email" dir="ltr" value="${esc(u.email || "")}"></label>
          <label class="f">الدور${'<select id="ueRole"' + (self ? " disabled" : "") + ">" + Object.entries(M.roles).map(([k, r]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${esc(r.label)}</option>`).join("") + "</select>"}</label>
          <label class="f">${isNew ? "كلمة المرور" : "كلمة مرور جديدة (اختياري)"}<input id="uePw" type="password" dir="ltr" minlength="6" autocomplete="new-password" placeholder="${isNew ? "6 أحرف على الأقل" : "اتركه فارغاً للإبقاء عليها"}"></label>
          <label class="f" style="flex-direction:row;align-items:center;gap:8px;display:flex"><input type="checkbox" id="ueActive" ${u.active !== false ? "checked" : ""} ${self ? "disabled" : ""} style="width:auto"> الحساب مفعّل</label>
        </div>
        <h4 style="margin:18px 0 6px">الوصول لكل منصة ${isAdmin ? '<span class="hint">(مدير النظام يملك كل الصلاحيات)</span>' : '<span class="hint">— تغيير أي خانة يجعل الدور «مخصّص»</span>'}</h4>
        <div class="tbl"><table class="perm"><thead><tr><th>المنصة</th>${M.levels.map((l) => `<th>${LV[l]}</th>`).join("")}</tr></thead><tbody>
          ${M.platforms.map((p) => `<tr><td>${esc(names[p] || p)}</td>${M.levels.map((l) => `<td><input type="radio" name="acc_${p}" value="${l}" ${u.access[p] === l ? "checked" : ""} ${isAdmin ? "disabled" : ""} aria-label="${esc(names[p] || p)}: ${LV[l]}"></td>`).join("")}</tr>`).join("")}
        </tbody></table></div>
        <h4 style="margin:18px 0 6px">صلاحيات عامة</h4>
        <div class="chips">${M.caps.map((c) => `<label class="chip"><input type="checkbox" data-cap="${c}" ${u.caps.includes(c) ? "checked" : ""} ${isAdmin || c === "users" ? "disabled" : ""}> ${CAPL[c]}</label>`).join("")}</div>
        <div class="exp-btns" style="margin-top:16px"><button class="btn pri" type="button" data-usave>${isNew ? "إنشاء المستخدم" : "حفظ الصلاحيات"}</button><button class="btn" type="button" data-ucancel>إلغاء</button>${!isNew && !self ? `<button class="btn" type="button" data-udel style="color:var(--bad);border-color:var(--bad)">حذف المستخدم</button>` : ""}</div>
        <p class="msg" id="ueMsg" role="status"></p></div>`;
    };
    const collect = () => {
      const u = state.edit, acc = {};
      META.platforms.forEach((p) => { const r = root.querySelector(`input[name="acc_${p}"]:checked`); acc[p] = r ? r.value : "none"; });
      const caps = [...root.querySelectorAll("[data-cap]:checked")].map((x) => x.dataset.cap);
      return { name: root.querySelector("#ueName").value.trim(), email: root.querySelector("#ueEmail").value.trim(), role: root.querySelector("#ueRole").value, access: acc, caps, active: root.querySelector("#ueActive").checked, password: root.querySelector("#uePw").value };
    };
    draw();
    root.onclick = async (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.unew !== undefined) { const r = META.roles.site_eng; state.edit = { name: "", email: "", role: "site_eng", access: { ...r.access }, caps: [...r.caps], active: true }; draw(); root.querySelector("#uEditor").scrollIntoView({ block: "start" }); return; }
      if (b.dataset.uedit) { state.edit = JSON.parse(JSON.stringify(state.users.find((x) => x.id === b.dataset.uedit))); draw(); root.querySelector("#uEditor").scrollIntoView({ block: "start" }); return; }
      if (b.dataset.ucancel !== undefined) { state.edit = null; draw(); return; }
      const m = root.querySelector("#ueMsg");
      if (b.dataset.usave !== undefined) {
        const d = collect(); if (!d.password) delete d.password;
        b.disabled = true; m.className = "msg"; m.textContent = "جارٍ الحفظ…";
        try {
          if (state.edit.id) await api("/api/users?id=" + state.edit.id, { method: "PUT", body: JSON.stringify(d) });
          else await api("/api/users", { method: "POST", body: JSON.stringify(d) });
          state.msg = (state.edit.id ? "حُفظت صلاحيات " : "أُنشئ حساب ") + d.name; state.msgErr = false; state.edit = null;
          state.users = (await api("/api/users")).users; draw();
        } catch (e) { m.className = "msg err"; m.textContent = e.message; b.disabled = false; }
        return;
      }
      if (b.dataset.udel !== undefined) {
        if (!confirm("حذف المستخدم " + state.edit.name + " نهائياً؟")) return;
        try { await api("/api/users?id=" + state.edit.id, { method: "DELETE" }); state.msg = "حُذف المستخدم"; state.msgErr = false; state.edit = null; state.users = (await api("/api/users")).users; draw(); }
        catch (e) { m.className = "msg err"; m.textContent = e.message; }
      }
    };
    root.onchange = (ev) => {
      const t = ev.target;
      if (t.id === "ueRole") { const r = META.roles[t.value]; if (t.value !== "custom") { Object.assign(state.edit, collect(), { role: t.value, access: { ...r.access }, caps: [...r.caps] }); draw(); } }
      else if (t.name && t.name.startsWith("acc_") || t.dataset.cap) { const sel = root.querySelector("#ueRole"); if (sel && sel.value !== "admin") sel.value = "custom"; }
    };
    root.oninput = (ev) => { if (ev.target.id === "usQ") { state.q = ev.target.value; draw(); const i = root.querySelector("#usQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  }

  async function changePassword(form, msgEl) {
    const cur = form.querySelector("#cpCur").value, pw = form.querySelector("#cpNew").value;
    try { await api("/api/auth/password", { method: "POST", body: JSON.stringify({ current: cur, password: pw }) }); msgEl.className = "msg ok"; msgEl.textContent = "تم تغيير كلمة المرور."; form.reset(); }
    catch (e) { msgEl.className = "msg err"; msgEl.textContent = e.message; }
  }

  window.AUTHUI = { ensure, logout, usersPanel, changePassword, LV, CAPL };
})();
