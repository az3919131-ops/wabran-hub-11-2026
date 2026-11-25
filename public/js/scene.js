/*
  مشهد نجران والطاقة: أبراج الطين النجرانية (على طراز قصر العان) أمام خطوط نقل الكهرباء عند الغروب.
  رسم متجهي واحد يُستخدم في شاشة الدخول وبانر الصفحة الرئيسية. لا صور خارجية.
*/
(function () {
  "use strict";
  // برج طيني نجراني: جسم مخروطي، شرائط جير بيضاء أعلاه، نوافذ صغيرة، وشرفات مسننة
  function tower(x, base, w, h, opt) {
    const o = Object.assign({ fill: "#C89B6E", shade: "#A97B52", lime: "#F7F3EE", rows: 4 }, opt || {});
    const top = base - h, taper = w * 0.12, xl = x + taper, xr = x + w - taper;
    let s = `<path d="M${x} ${base}L${xl} ${top}L${xr} ${top}L${x + w} ${base}Z" fill="${o.fill}"/>`;
    s += `<path d="M${x + w * 0.62} ${base}L${xr - w * 0.04} ${top}L${xr} ${top}L${x + w} ${base}Z" fill="${o.shade}" opacity=".55"/>`;
    // شرائط الجير
    [0.06, 0.14].forEach((f) => { const y = top + h * f; const ins = taper * (1 - f); s += `<rect x="${x + ins}" y="${y}" width="${w - 2 * ins}" height="${Math.max(2, h * 0.035)}" fill="${o.lime}" opacity=".92"/>`; });
    // شرفات مسننة
    const n = Math.max(3, Math.round((xr - xl) / 9)), step = (xr - xl) / n;
    for (let i = 0; i < n; i++) s += `<path d="M${xl + i * step + step * 0.15} ${top}l${step * 0.35} ${-step * 0.55}l${step * 0.35} ${step * 0.55}Z" fill="${o.lime}" opacity=".9"/>`;
    // نوافذ
    for (let r = 0; r < o.rows; r++) {
      const y = top + h * (0.26 + r * (0.6 / o.rows)), ins = taper * (1 - (y - top) / h);
      const cols = w > 46 ? 3 : 2;
      for (let c = 0; c < cols; c++) { const cx = x + ins + (w - 2 * ins) * ((c + 0.5) / cols) - 2.5; s += `<rect x="${cx}" y="${y}" width="5" height="7" rx="1" fill="#3B2A1E" opacity=".75"/>`; }
    }
    return s;
  }
  // برج نقل كهرباء شبكي
  function pylon(x, base, h, col) {
    const top = base - h, w = h * 0.34, a = h * 0.2;
    let s = `<g stroke="${col}" stroke-width="1.6" fill="none" stroke-linejoin="round">`;
    s += `<path d="M${x - w / 2} ${base}L${x - 3} ${top}L${x + 3} ${top}L${x + w / 2} ${base}"/>`;
    for (let i = 1; i < 6; i++) { const y = base - (h * i) / 6, half = (w / 2) * (1 - i / 6.4) + 2; s += `<path d="M${x - half} ${y}L${x + half} ${y + h / 6}M${x + half} ${y}L${x - half} ${y + h / 6}" opacity=".55"/>`; }
    s += `<path d="M${x - a} ${top + h * 0.12}L${x + a} ${top + h * 0.12}M${x - a * 0.75} ${top + h * 0.27}L${x + a * 0.75} ${top + h * 0.27}"/>`;
    return s + "</g>";
  }
  function scene(id, align) {
    const g = "g" + (id || "s");
    const base = 300;
    const P = [[330, 200], [620, 230], [900, 236], [1170, 228]];
    // أسلاك متدلية بين الأبراج (ثلاثة خطوط)
    let wires = "";
    [0.12, 0.27].forEach((f, k) => {
      for (let i = 0; i < P.length - 1; i++) {
        const [x1, h1] = P[i], [x2, h2] = P[i + 1], y1 = base - h1 + h1 * f, y2 = base - h2 + h2 * f, arm = h1 * 0.2 * (k ? 0.75 : 1);
        [-arm, arm].forEach((d) => { wires += `<path d="M${x1 + d} ${y1}Q${(x1 + x2) / 2 + d} ${Math.max(y1, y2) + 34}  ${x2 + d} ${y2}" stroke="#F37021" stroke-width="1.3" fill="none" opacity="${k ? 0.5 : 0.75}"/>`; });
      }
    });
    return `<svg class="nj-scene" viewBox="0 0 1200 340" preserveAspectRatio="${align === "start" ? "xMinYMax" : "xMidYMax"} slice" role="img" aria-label="أبراج الطين النجرانية أمام خطوط نقل الكهرباء">
      <defs>
        <linearGradient id="${g}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F2537"/><stop offset=".55" stop-color="#1B3550"/><stop offset=".86" stop-color="#7A4A3A"/><stop offset="1" stop-color="#F37021"/></linearGradient>
        <radialGradient id="${g}sun" cx=".24" cy=".86" r=".42"><stop offset="0" stop-color="#F7B27A" stop-opacity=".85"/><stop offset="1" stop-color="#F37021" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1200" height="340" fill="url(#${g}sky)"/>
      <rect width="1200" height="340" fill="url(#${g}sun)"/>
      <linearGradient id="${g}veil" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0F2537" stop-opacity=".55"/><stop offset=".5" stop-color="#0F2537" stop-opacity="0"/></linearGradient>
      <circle cx="300" cy="258" r="30" fill="#F9C79B" opacity=".9"/>
      ${P.map(([x, h]) => pylon(x, base, h, "rgba(247,243,238,.42)")).join("")}
      ${wires}
      <path d="M0 300 C140 292 260 304 380 296 S620 286 760 296 S1030 306 1200 294 V340 H0Z" fill="#6E4A32"/>
      <path d="M90 300 C120 250 170 232 230 236 C290 230 350 246 390 300Z" fill="#7E5639"/>
      <g>${tower(130, 252, 48, 84, { rows: 3 })}${tower(176, 246, 62, 120, { rows: 5 })}${tower(236, 250, 44, 74, { rows: 3 })}</g>
      <g>${tower(10, 306, 50, 92)}${tower(400, 304, 54, 104)}${tower(458, 304, 40, 70, { rows: 3 })}</g>
      <rect width="1200" height="340" fill="url(#${g}veil)"/>
      <path d="M0 312 C200 306 400 318 600 310 S1000 302 1200 312 V340 H0Z" fill="#4A3122"/>
      <path d="M0 330 H1200" stroke="#C89B6E" stroke-width="2" stroke-dasharray="14 6 4 6" opacity=".7"/>
    </svg>`;
  }
  window.NJ = { scene };
})();
