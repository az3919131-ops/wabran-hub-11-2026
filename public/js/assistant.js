/* المساعد الذكي: يرسل السؤال مع سياق كل المنصات إلى /api/assistant (Claude عبر Netlify AI Gateway).
   إن لم يتوفر الذكاء الاصطناعي يجيب محرك محلي من نفس البيانات، ويقول ذلك صراحة. */
(function () {
  "use strict";
  const { U } = HUB;
  const { $, esc } = U;
  const chat = $("#chat"), drawer = $("#drawer"), scrim = $("#scrim"), input = $("#askInput");
  const history = [];
  const QUICK = ["ملخص اليوم", "ما نواقص البيانات؟", "الرخص المتجاوزة", "بطاقات السلامة المنتهية", "أداء المهندسين في الرخص"];

  function open(on) {
    drawer.classList.toggle("open", on);
    drawer.setAttribute("aria-hidden", String(!on));
    scrim.hidden = !on;
    $("#askBtn").setAttribute("aria-expanded", String(on));
    if (on) { if (!chat.children.length) greet(); setTimeout(() => input.focus(), 50); }
  }
  function bubble(text, who, meta) {
    const d = document.createElement("div");
    d.className = "msgb " + who;
    d.innerHTML = esc(text) + (meta ? `<small>${esc(meta)}</small>` : "");
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
  }
  function greet() {
    const E = HUB.evaluateAll();
    bubble(`أهلاً. أقرأ الآن ${E.total} منصات للفرع (التنبيهات: ${E.alerts.length}، نواقص البيانات: ${E.gaps.length}). اسألني عن أي رخصة أو عامل أو منصة، أو اطلب ملخص اليوم.`, "ai");
  }
  $("#quick").innerHTML = QUICK.map((q) => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join("");

  /* ---------- المحرك المحلي ---------- */
  function local(q) {
    const E = HUB.evaluateAll();
    const lic = HUB.licRows(), cards = HUB.cardRows();
    const t = U.toEn(q).toLowerCase();
    const num = t.match(/\d{5,}/);
    if (num) {
      const r = lic.find((x) => x.id.includes(num[0]) || String(x.wo).includes(num[0]));
      if (r) return `الرخصة ${r.id} — ${r.loc} (أمر العمل ${r.wo})، المهندس ${r.eng}.\nتنتهي ${U.dmy(r.end)}: ${r.closed ? "مغلقة بشهادة إخلاء طرف" : r.over > 0 ? "متجاوزة " + U.days(r.over) : "سارية"}.\nالموقف: ${r.clsName}.\nالسبب: ${r.why || "—"}\nالإجراء: ${r.act}`;
      const c = cards.find((x) => String(x.iqama).includes(num[0]) || String(x.badge).includes(num[0]));
      if (c) return cardLine(c);
    }
    const emp = t.match(/\b[a-z]{1,2}-\d{3,4}\b/);
    if (emp) { const c = cards.find((x) => x.emp.toLowerCase() === emp[0]); if (c) return cardLine(c); }
    const byName = cards.filter((c) => t.length > 3 && c.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && t.includes(w)));
    if (byName.length && byName.length <= 4) return byName.map(cardLine).join("\n\n");

    if (/ملخص|موقف|تقرير|summary/.test(t)) {
      const top = E.alerts.slice(0, 3).map((a, i) => `${i + 1}. ${a.text}`).join("\n");
      return `موقف الفرع ${U.longDate()}: مؤشر السلامة العام ${E.overall ?? "—"}% من ${E.covered} من ${E.total} منصات.\n\nأهم ما يحتاج قراراً:\n${top || "لا تنبيهات."}\n\nنواقص البيانات (${E.gaps.length}):\n${E.gaps.slice(0, 5).map((g) => "• " + g.text).join("\n") || "لا نواقص."}`;
    }
    if (/ناقص|نواقص|نقص|ينقص/.test(t)) return E.gaps.length ? "نواقص البيانات:\n" + E.gaps.map((g) => "• " + g.text).join("\n") : "البيانات مكتملة.";
    if (/مهندس/.test(t)) {
      const engs = [...new Set(lic.map((r) => r.eng || "غير محدد"))];
      return "الرخص حسب المهندس:\n" + engs.map((e) => { const a = lic.filter((r) => (r.eng || "غير محدد") === e), o = a.filter((r) => !r.closed), ov = o.filter((r) => r.over > 0); return `• ${e}: ${a.length} رخصة، ${o.length} مفتوحة، ${ov.length} متجاوزة${ov.length ? "، أقدمها " + Math.max(...ov.map((r) => r.over)) + " يوماً" : ""}`; }).join("\n");
    }
    if (/رخص|رخصة|تصريح|اخلاء|إخلاء/.test(t)) {
      const ov = lic.filter((r) => !r.closed && r.over > 0).sort((a, b) => b.over - a.over);
      return `الرخص (ملف ${U.dmy(HUB.S.licenses.asof)}): ${lic.length} رخصة، ${lic.filter((r) => r.closed).length} مغلقة، ${ov.length} مفتوحة متجاوزة.\n\n` + ov.map((r) => `• ${r.loc} ${r.id.slice(-5)} — ${r.over} يوماً — ${r.clsName}. الإجراء: ${r.act}`).join("\n");
    }
    if (/سلامة|بطاق|هوي|عامل|عمال/.test(t)) {
      const ex = cards.filter((c) => c.st === "expired"), wk = cards.filter((c) => c.st === "week");
      return `بطاقات السلامة: ${cards.length} عاملاً، ${ex.length} منتهية، ${wk.length} تنتهي خلال أسبوع.\n\nالمنتهية:\n` + ex.map((c) => `• ${c.emp} ${c.name} — منذ ${U.days(c.left)}${c.remark ? " (" + c.remark + ")" : ""}`).join("\n") + (wk.length ? "\n\nخلال أسبوع:\n" + wk.map((c) => `• ${c.emp} ${c.name} — بعد ${U.days(c.left)}`).join("\n") : "");
    }
    const p = REGISTRY.find((x) => x.kind === "linked" && (t.includes(x.short) || t.includes(x.name) || (x.id === "invoices" && /فاتور|تحصيل/.test(t)) || (x.id === "projects" && /مشروع|مشاريع/.test(t)) || (x.id === "assign" && /اسناد|إسناد/.test(t)) || (x.id === "dispatch" && /فرق|تخطيط/.test(t)) || (x.id === "schedule" && /جدول/.test(t))));
    if (p) {
      const s = HUB.latest(p.id);
      if (!s) return `${p.name}: لا توجد قراءة مسجلة بعد في البوابة. أدخلها من تبويب «إدخال القراءة» في المنصة لأتمكن من تحليلها.`;
      const ev = E.items.find((i) => i.id === p.id);
      return `${p.name} — آخر قراءة ${U.dmy(s.date)}:\n` + p.fields.map((f) => `• ${f.label}: ${U.fmt(s.values[f.key])}${f.unit ? " " + f.unit : ""}`).join("\n") + `\nالحالة: ${ev.issue}`;
    }
    return "لم أفهم السؤال بالمحرك المحلي. جرّب: رقم رخصة أو أمر عمل، رقم موظف مثل S-1156، اسم عامل، أو كلمات مثل: ملخص، نواقص، الرخص، السلامة، الفواتير.";
  }
  function cardLine(c) { return `${c.emp} — ${c.name}\nالإقامة ${c.iqama} · بطاقة المقاول ${c.badge}\nتنتهي ${U.dmy(c.exp)}: ${HUB.CARD_ST[c.st]}${c.left < 0 ? " منذ " + U.days(c.left) : " بعد " + U.days(c.left)}${c.remark ? "\nملاحظة: " + c.remark : ""}`; }

  /* ---------- السؤال ---------- */
  async function ask(q, opt = {}) {
    if (!opt.silent) { bubble(q, "me"); }
    history.push({ role: "user", content: q });
    const wait = opt.silent ? null : bubble("…", "ai");
    let text, ai = false;
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history, context: HUB.buildContext() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.reply) throw new Error(j.error || r.status);
      text = j.reply; ai = true;
    } catch (e) {
      text = local(q);
    }
    history.push({ role: "assistant", content: text });
    $("#aiMode").textContent = ai ? "متصل بالذكاء الاصطناعي · يقرأ كل منصات الفرع" : "المحرك المحلي · الذكاء الاصطناعي غير متاح الآن";
    if (wait) { wait.innerHTML = esc(text) + `<small>${ai ? "الذكاء الاصطناعي" : "المحرك المحلي من بيانات المنصة"}</small>`; chat.scrollTop = chat.scrollHeight; }
    return { text, ai };
  }

  $("#askBtn").addEventListener("click", () => open(!drawer.classList.contains("open")));
  $("#drClose").addEventListener("click", () => open(false));
  scrim.addEventListener("click", () => open(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) open(false); });
  $("#askForm").addEventListener("submit", (e) => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ""; ask(q); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#askForm").requestSubmit(); } });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-q],[data-ask]"); if (!b) return;
    open(true); ask(b.dataset.q || b.dataset.ask);
  });

  window.ASSIST = { ask, open };
})();
