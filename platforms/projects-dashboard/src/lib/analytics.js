// الحسابات المشتركة: تطبيع الصفوف، المؤشرات، خطة التحصيل، المقارنة، الملخص التنفيذي، التنسيق.
import { normAr } from './parse.js';

// ---------- تنسيق ----------
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const fmtNum = (v) => (isNum(v) ? nf0.format(v) : '—');
export const fmtSAR = (v) => (isNum(v) ? `${nf0.format(v)} ر.س` : '—');
export const fmtM = (v) =>
  !isNum(v) ? '—' : Math.abs(v) >= 1e6 ? `${nf2.format(v / 1e6)} مليون` : Math.abs(v) >= 1e3 ? `${nf2.format(v / 1e3)} ألف` : nf0.format(v);
export const fmtPct = (r, d = 1) => (isNum(r) ? `${(r * 100).toFixed(d).replace(/\.0+$/, '')}%` : '—');
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
};
export const cellText = (v) => (v == null ? '' : typeof v === 'object' ? v.err : isNum(v) ? (Number.isInteger(v) ? String(v) : nf2.format(v)) : String(v));
export const sum = (arr) => arr.reduce((a, b) => a + (isNum(b) ? b : 0), 0);

// تاريخ مرن: ISO أو 13-3-2025 أو 29/12/2021 أو 2022/06/27 أو رقم تسلسلي من Excel
export function parseDateLoose(v) {
  if (v == null) return null;
  if (isNum(v)) return v > 20000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// ---------- ربط الأعمدة حسب العناوين الأصلية ----------
const FIELD_KEYS = {
  seq: ['م'],
  wo: ['رقم امر العمل'],
  type: ['نوع امر العمل'],
  received: ['تاريخ استلام'],
  invoice: ['الاجور طبقا للفاتور'],
  name: ['اسم المشروع'],
  status: ['موقف التنفيذ'],
  est: ['تكلفه العماله التقديريه'],
  exec: ['تكلفه العماله حسب المنفذ'],
  ratio: ['نسبه التنفيذ'],
  delivered: ['تاريخ تسليم امر العمل'],
  partial: ['مبلغ الصرف الجزئي', 'الصرف الجزئي'],
  certDate: ['تاريخ اصدار الشهاده'],
  final: ['مبلغ الصرف النهائي'],
  claimNo: ['رقم المستخلص'],
  claim: ['موقف صرف المستخلص'],
  materials: ['موقف المواد'],
  remaining: ['الاعمال المتبقيه'],
  done: ['الاعمال المنتهيه'],
  uds: ['uds'],
};
export function mapColumns(columns, keys = FIELD_KEYS) {
  const map = {};
  for (const [f, kws] of Object.entries(keys)) {
    const k = kws.map(normAr);
    const exact = columns.find((c) => k.includes(normAr(c.label)));
    const part = exact || columns.find((c) => k.some((x) => normAr(c.label).includes(x) && (x.length > 2 || normAr(c.label) === x)));
    if (part) map[f] = part.col;
  }
  return map;
}

const numOrNull = (v) => (isNum(v) ? v : null);
const txt = (v) => (v == null ? null : typeof v === 'object' ? v.err : String(v).trim() || null);
const ratioVal = (v) => (isNum(v) ? (v > 10 ? v / 100 : v) : null); // نسبة مخزنة كرقم مئوي (95) تُقرأ 0.95

export const DONE_RX = /^(منتهي|تم الانتهاء|تم الانتهاء بالكامل|تم انتهاء)$/;
export const hasRemaining = (p) => !!p.remaining && !DONE_RX.test(normAr(p.remaining));

/** تحويل جدول المشاريع الخام إلى كائنات موحدة */
export function projectRows(pd) {
  if (!pd) return [];
  const m = mapColumns(pd.columns);
  const g = (row, f) => (m[f] ? row.cells[m[f]] : undefined);
  return pd.rows.map((row) => {
    const woRaw = g(row, 'wo');
    const p = {
      _row: row._row,
      seq: g(row, 'seq'),
      wo: woRaw != null ? String(txt(woRaw)) : null,
      name: txt(g(row, 'name')),
      type: txt(g(row, 'type')),
      status: txt(g(row, 'status')),
      invoice: numOrNull(g(row, 'invoice')),
      est: numOrNull(g(row, 'est')),
      exec: numOrNull(g(row, 'exec')),
      ratio: ratioVal(g(row, 'ratio')),
      partial: numOrNull(g(row, 'partial')),
      final: numOrNull(g(row, 'final')),
      claimNo: txt(g(row, 'claimNo')),
      claim: txt(g(row, 'claim')),
      materials: txt(g(row, 'materials')),
      remaining: txt(g(row, 'remaining')),
      done: txt(g(row, 'done')),
      uds: txt(g(row, 'uds')),
      received: parseDateLoose(g(row, 'received')),
      delivered: parseDateLoose(g(row, 'delivered')),
      certDate: parseDateLoose(g(row, 'certDate')),
      notes: [],
      merged: row.merged || {},
      cells: row.cells,
      extras: row.extras || {},
    };
    // نص داخل عمود رقمي (مثل "مقفل ماليا وباقي اعمال بالموقع")
    for (const f of ['est', 'exec', 'invoice', 'partial', 'final']) {
      const v = g(row, f);
      if (v != null && !isNum(v)) p.notes.push(txt(v));
    }
    // خلية دمج أرقام مع صف آخر: القيمة محسوبة مرة واحدة في الصف الأول
    for (const f of ['est', 'exec', 'ratio']) {
      const r = m[f] && row.merged?.[m[f]];
      if (r && g(row, f) == null) p.sharedWith = r;
    }
    if (m.remaining && m.done && row.merged?.[m.remaining] && row.merged[m.remaining] === row.merged[m.done]) p.remDoneMerged = true;
    p.key = p.wo || `row-${row._row}`;
    p.hasRemaining = hasRemaining(p);
    return p;
  });
}

export const ratioBucket = (r) =>
  !isNum(r) ? 'غير محددة' : r > 1 ? 'أكبر من 100%' : r === 1 ? '100%' : r >= 0.75 ? '75% – 99%' : r >= 0.5 ? '50% – 74%' : r >= 0.25 ? '25% – 49%' : 'أقل من 25%';
export const RATIO_BUCKETS = ['أقل من 25%', '25% – 49%', '50% – 74%', '75% – 99%', '100%', 'أكبر من 100%', 'غير محددة'];

export function countBy(list, f, empty = 'غير محدد') {
  const m = new Map();
  for (const x of list) {
    const k = (typeof f === 'function' ? f(x) : x[f]) || empty;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function projectKpis(list) {
  const both = list.filter((p) => isNum(p.est) && isNum(p.exec));
  const est = sum(list.map((p) => p.est));
  const exec = sum(list.map((p) => p.exec));
  const estBoth = sum(both.map((p) => p.est));
  const execBoth = sum(both.map((p) => p.exec));
  return {
    count: list.length,
    invoice: sum(list.map((p) => p.invoice)),
    invoiceN: list.filter((p) => isNum(p.invoice)).length,
    est, exec,
    estN: list.filter((p) => isNum(p.est)).length,
    execN: list.filter((p) => isNum(p.exec)).length,
    // النسبة المالية الإجمالية = إجمالي المنفذ ÷ إجمالي التقديري (للمشاريع التي لها القيمتان)
    ratio: estBoth > 0 ? execBoth / estBoth : null,
    partial: sum(list.map((p) => p.partial)),
    partialN: list.filter((p) => isNum(p.partial)).length,
    final: sum(list.map((p) => p.final)),
    finalN: list.filter((p) => isNum(p.final)).length,
    byStatus: countBy(list, 'status'),
    remainingN: list.filter((p) => p.hasRemaining).length,
    over100: list.filter((p) => isNum(p.ratio) && p.ratio > 1).length,
  };
}

/** مقارنة الإجماليات المحسوبة مع صف الإجمالي في Excel */
export function totalsCheck(pd) {
  if (!pd?.total) return [];
  const m = mapColumns(pd.columns);
  const list = projectRows(pd);
  const out = [];
  for (const f of ['est', 'exec', 'partial', 'final', 'invoice']) {
    const xv = m[f] && pd.total.cells[m[f]];
    if (!isNum(xv)) continue;
    const calc = sum(list.map((p) => p[f]));
    out.push({ field: f, label: pd.columns.find((c) => c.col === m[f])?.label, excel: xv, calc, ok: Math.abs(xv - calc) < 1 });
  }
  return out;
}

// ---------- خطة التحصيل ----------
export function collectionModel(cd) {
  if (!cd) return { blocks: [], side: null, orphans: [] };
  const blocks = cd.blocks.map((b, i) => {
    const m = mapColumns(b.columns, { seq: ['م'], wo: ['رقم امر العمل'], name: ['اسم المشروع'], status: ['موقف وملاحظات'], gis: ['gis'] });
    const isStage = (c) => /مرحله/.test(normAr(c.label));
    const isPartial = (c) => /جزئي/.test(normAr(c.label)) && !isStage(c);
    const stages = b.columns.filter(isStage).map((c) => ({ col: c.col, label: c.label.replace(/\s+/g, ' ').trim() }));
    const partialCols = b.columns.filter(isPartial);
    const known = new Set([...Object.values(m), ...stages.map((s) => s.col), ...partialCols.map((c) => c.col)]);
    const otherCols = b.columns.filter((c) => !known.has(c.col) && b.rows.some((r) => r.cells[c.col] != null));
    const rows = b.rows.map((r) => {
      const st = {}, errs = [];
      for (const s of stages) {
        const v = r.cells[s.col];
        if (isNum(v)) st[s.col] = v;
        else if (v && typeof v === 'object') errs.push(`${s.label}: ${v.err}`);
      }
      const partialVals = partialCols.map((c) => r.cells[c.col]);
      const stageList = stages.filter((s) => st[s.col] != null);
      return {
        _row: r._row,
        wo: r.cells[m.wo] != null ? String(txt(r.cells[m.wo])) : null,
        name: txt(r.cells[m.name]),
        status: txt(r.cells[m.status]),
        gis: txt(r.cells[m.gis]),
        partial: numOrNull(partialVals.find(isNum)),
        partialText: partialVals.filter((v) => v != null && !isNum(v)).map(txt),
        stages: st,
        stageList,
        total: sum(Object.values(st)),
        errs,
        cells: r.cells,
        extras: r.extras || {},
        merged: r.merged || {},
      };
    });
    // التحقق من التكرار: نفس أمر العمل أكثر من مرة في نفس الجدول
    const seen = new Map();
    rows.forEach((r) => r.wo && seen.set(r.wo, (seen.get(r.wo) || 0) + 1));
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([wo]) => wo);
    rows.forEach((r) => (r.duplicate = dupes.includes(r.wo)));
    const stageTotals = stages.map((s) => ({
      ...s,
      total: sum(rows.map((r) => r.stages[s.col])),
      count: rows.filter((r) => r.stages[s.col] != null).length,
      excel: b.total?.cells[s.col],
    }));
    return {
      index: i,
      title: b.title || `جدول ${i + 1}`,
      columns: b.columns,
      stages: stageTotals,
      partialLabel: partialCols[0]?.label,
      partialTotal: sum(rows.map((r) => r.partial)),
      partialN: rows.filter((r) => r.partial != null).length,
      otherCols,
      rows,
      dupes,
      multiStage: rows.filter((r) => r.stageList.length > 1).length,
      grand: sum(stageTotals.map((s) => s.total)),
      excelTotal: b.total,
      excelGrand: m.status && isNum(b.total?.cells[m.status]) ? b.total.cells[m.status] : null,
      titleNotes: b.titleNotes || [],
      hasErrors: rows.some((r) => r.errs.length) || Object.values(b.total?.cells || {}).some((v) => v && typeof v === 'object'),
    };
  });
  return { blocks, side: cd.side, orphans: cd.orphans || [] };
}

// ---------- المقارنة الأسبوعية ----------
const keyed = (list) => {
  const map = new Map(), dup = new Set();
  for (const p of list) {
    if (!p.wo) continue;
    if (map.has(p.wo)) dup.add(p.wo);
    else map.set(p.wo, p);
  }
  return { map, dup };
};
const COMPARE_FIELDS = [
  ['status', 'موقف التنفيذ'],
  ['ratio', 'نسبة التنفيذ'],
  ['exec', 'التكلفة المنفذة'],
  ['est', 'التكلفة التقديرية'],
  ['claim', 'موقف المستخلص'],
  ['materials', 'موقف المواد'],
  ['remaining', 'الأعمال المتبقية'],
  ['done', 'الأعمال المنتهية'],
  ['uds', 'موقف UDS'],
];

export function compareReports(prev, cur) {
  const A = projectRows(prev.projects_data), B = projectRows(cur.projects_data);
  const ka = keyed(A), kb = keyed(B);
  const items = [];
  for (const p of B) {
    if (!p.wo) continue;
    const o = ka.map.get(p.wo);
    if (!o) { items.push({ wo: p.wo, name: p.name, badge: 'جديد', cur: p, changes: [] }); continue; }
    if (items.some((x) => x.wo === p.wo)) continue;
    const changes = [];
    for (const [f, label] of COMPARE_FIELDS) {
      const a = o[f], b = p[f];
      if ((a ?? null) === (b ?? null)) continue;
      if (isNum(a) && isNum(b) && Math.abs(a - b) < 1e-6) continue;
      changes.push({ field: f, label, from: a, to: b, diff: isNum(a) && isNum(b) ? b - a : null });
    }
    let badge = 'بدون تغيير';
    const st = changes.find((c) => c.field === 'status');
    const up = changes.find((c) => (c.field === 'ratio' || c.field === 'exec') && c.diff > 0);
    if (st) badge = 'تغير الموقف';
    else if (up) badge = 'تقدم';
    else if (changes.length) badge = 'تحديث بيانات';
    items.push({ wo: p.wo, name: p.name, badge, prev: o, cur: p, changes });
  }
  for (const o of A) if (o.wo && !kb.map.has(o.wo) && !items.some((x) => x.wo === o.wo)) items.push({ wo: o.wo, name: o.name, badge: 'غير موجود بالتقرير الحالي', prev: o, changes: [] });

  const kA = projectKpis(A), kB = projectKpis(B);
  const metrics = [
    ['عدد المشاريع', kA.count, kB.count, 'n'],
    ['إجمالي الأجور طبقاً للفواتير', kA.invoice, kB.invoice, 'sar'],
    ['إجمالي التكلفة التقديرية', kA.est, kB.est, 'sar'],
    ['إجمالي التكلفة المنفذة', kA.exec, kB.exec, 'sar'],
    ['نسبة التنفيذ المالية الإجمالية', kA.ratio, kB.ratio, 'pct'],
    ['إجمالي الصرف الجزئي', kA.partial, kB.partial, 'sar'],
    ['إجمالي الصرف النهائي', kA.final, kB.final, 'sar'],
    ['مشاريع لديها أعمال متبقية', kA.remainingN, kB.remainingN, 'n'],
  ];
  // مراحل التحصيل (الجدول الأول) بمطابقة عنوان المرحلة
  const cA = collectionModel(prev.collections_data).blocks[0], cB = collectionModel(cur.collections_data).blocks[0];
  const stageChanges = [];
  if (cA && cB) {
    for (const s of cB.stages) {
      const o = cA.stages.find((x) => normAr(x.label) === normAr(s.label));
      metrics.push([`تحصيل: ${s.label}`, o ? o.total : null, s.total, 'sar']);
    }
    const mapA = new Map(cA.rows.filter((r) => r.wo).map((r) => [r.wo, r]));
    for (const r of cB.rows) {
      if (!r.wo) continue;
      const o = mapA.get(r.wo);
      const fromS = o ? o.stageList.map((s) => s.label).join(' + ') : '—';
      const toS = r.stageList.map((s) => s.label).join(' + ');
      if (!o || fromS !== toS || Math.abs(o.total - r.total) > 0.5 || o.status !== r.status)
        stageChanges.push({ wo: r.wo, name: r.name, from: fromS, to: toS, fromTotal: o?.total ?? null, toTotal: r.total, fromStatus: o?.status, toStatus: r.status, isNew: !o });
    }
  }
  return { items, metrics, stageChanges, dupA: [...ka.dup], dupB: [...kb.dup] };
}

// ---------- الملخص التنفيذي (قواعد حسابية فقط) ----------
export function executiveSummary(report, prevReport) {
  const list = projectRows(report.projects_data);
  const k = projectKpis(list);
  const col = collectionModel(report.collections_data).blocks[0];
  const out = [];
  if (!list.length) return out;
  out.push({
    tone: 'info',
    title: 'الموقف العام',
    text: `${k.count} مشروعاً؛ ${k.byStatus.map((s) => `${s.name}: ${s.value}`).join('، ')}. نسبة التنفيذ المالية الإجمالية ${fmtPct(k.ratio)} (${fmtM(k.exec)} من ${fmtM(k.est)} ر.س).`,
  });
  const full = list.filter((p) => isNum(p.ratio) && p.ratio >= 1);
  out.push({
    tone: 'good',
    title: 'أبرز الإنجازات',
    text: `${full.length} مشروعاً بنسبة تنفيذ مالية 100% أو أكثر` + (k.partialN ? `، وصرف جزئي مسجل ${fmtM(k.partial)} ر.س لعدد ${k.partialN} مشروعاً.` : '.'),
  });
  if (prevReport) {
    const cmp = compareReports(prevReport, report);
    const ch = cmp.items.filter((i) => i.badge === 'تغير الموقف');
    const nw = cmp.items.filter((i) => i.badge === 'جديد');
    const pr = cmp.items.filter((i) => i.badge === 'تقدم');
    out.push({
      tone: 'warn',
      title: 'التغيرات منذ التقرير السابق',
      text: ch.length || nw.length || pr.length
        ? [ch.length && `تغير موقف ${ch.length}: ${ch.slice(0, 3).map((i) => i.name || i.wo).join('، ')}`, pr.length && `تقدم ${pr.length}`, nw.length && `جديد ${nw.length}`].filter(Boolean).join(' • ')
        : 'لا توجد تغيرات في المواقف مقارنة بالتقرير السابق.',
    });
  }
  const rem = list.filter((p) => p.hasRemaining).sort((a, b) => (b.est ?? 0) - (a.est ?? 0)).slice(0, 3);
  if (rem.length)
    out.push({ tone: 'warn', title: 'أهم الأعمال المتبقية', text: rem.map((p) => `${p.name || p.wo}: ${p.remaining}`).join(' • ') });
  if (col) {
    const top = [...col.rows].sort((a, b) => b.total - a.total).slice(0, 3);
    out.push({ tone: 'info', title: 'أكبر فرص التحصيل (محتملة)', text: top.map((r) => `${r.name || r.wo} ${fmtM(r.total)}`).join(' • ') });
  }
  const follow = list.filter((p) => (isNum(p.ratio) && p.ratio < 0.5) || /موازنه/.test(normAr(p.status)));
  if (follow.length)
    out.push({
      tone: 'bad',
      title: 'مشاريع تحتاج متابعة',
      text: `${follow.length} مشروعاً (موقف "جاري موازنة المواد" أو نسبة تنفيذ أقل من 50%): ${follow.slice(0, 4).map((p) => p.name || p.wo).join('، ')}${follow.length > 4 ? '…' : ''}`,
    });
  return out;
}

// ---------- ألوان المواقف ----------
export function statusTone(s) {
  const n = normAr(s);
  if (!n) return 'slate';
  if (/(تم الاصدار|منتهي|تم الانتهاء|تم الصرف|تم اعتماد|تم الرسم والاعتماد|تم صرف)/.test(n)) return 'green';
  if (/(رفض|متوقف|مشكله|معوق|#ref)/.test(n)) return 'red';
  if (/(جاري|متبقي|ارجاع|موازنه|اعداد|انتظار)/.test(n)) return 'orange';
  return 'blue';
}

// ---------- تحذيرات الاستيراد ----------
export function validateReport(report) {
  const w = [];
  const pd = report.projects_data;
  if (!pd) return [{ level: 'error', text: 'لا يوجد جدول مشاريع.' }];
  const list = projectRows(pd);
  const m = mapColumns(pd.columns);
  for (const [f, l] of [['wo', 'رقم أمر العمل'], ['name', 'اسم المشروع'], ['status', 'موقف التنفيذ'], ['est', 'تكلفة العمالة التقديرية'], ['exec', 'تكلفة العمالة حسب المنفذ']])
    if (!m[f]) w.push({ level: 'error', text: `عمود "${l}" غير موجود في شيت المشاريع.` });
  const { dup } = keyed(list);
  if (dup.size) w.push({ level: 'warn', text: `أرقام أوامر عمل مكررة في شيت المشاريع: ${[...dup].join('، ')} (تُعرض كلها، وتُستخدم الأولى في المقارنة).` });
  const noWo = list.filter((p) => !p.wo);
  if (noWo.length) w.push({ level: 'warn', text: `${noWo.length} صف بدون رقم أمر عمل (صفوف: ${noWo.map((p) => p._row).join('، ')}).` });
  const noName = list.filter((p) => !p.name);
  if (noName.length) w.push({ level: 'info', text: `${noName.length} صف بدون اسم مشروع (صفوف: ${noName.map((p) => p._row).join('، ')}).` });
  const notes = list.filter((p) => p.notes.length);
  if (notes.length) w.push({ level: 'info', text: `${notes.length} مشروع به نص داخل عمود مالي (مثل "${notes[0].notes[0]}") — لم يُحتسب رقماً.` });
  const shared = list.filter((p) => p.sharedWith);
  if (shared.length) w.push({ level: 'info', text: `خلايا مدمجة بين أكثر من أمر عمل (${[...new Set(shared.map((p) => p.sharedWith))].join('، ')}) — القيمة المالية محسوبة مرة واحدة.` });
  const over = list.filter((p) => isNum(p.ratio) && p.ratio > 1);
  if (over.length) w.push({ level: 'info', text: `${over.length} مشروع بنسبة تنفيذ أكبر من 100% — محفوظة كما هي.` });
  for (const t of totalsCheck(pd)) if (!t.ok) w.push({ level: 'warn', text: `إجمالي "${t.label}" المحسوب ${fmtNum(t.calc)} يختلف عن صف الإجمالي في Excel ${fmtNum(t.excel)}.` });
  const col = collectionModel(report.collections_data);
  col.blocks.forEach((b) => {
    for (const s of b.stages) {
      if (s.excel && typeof s.excel === 'object') w.push({ level: 'warn', text: `${b.title}: إجمالي "${s.label}" في Excel به خطأ ${s.excel.err} — تم الحساب من الصفوف.` });
      else if (isNum(s.excel) && Math.abs(s.excel - s.total) > 1) w.push({ level: 'warn', text: `${b.title}: مجموع "${s.label}" من الصفوف ${fmtNum(s.total)} ≠ إجمالي Excel ${fmtNum(s.excel)} (فرق ${fmtNum(s.total - s.excel)}؛ قد يكون صف غير مشمول في معادلة الإجمالي).` });
    }
    const errRows = b.rows.filter((r) => r.errs.length);
    if (errRows.length) w.push({ level: 'warn', text: `${b.title}: ${errRows.length} صف به خطأ مرجعي (#REF!) — لم يُحتسب.` });
    if (b.dupes.length) w.push({ level: 'warn', text: `${b.title}: أوامر عمل مكررة ${b.dupes.join('، ')}.` });
  });
  if (col.orphans.length) w.push({ level: 'info', text: `شيت التحصيل: ${col.orphans.length} صف بدون عناوين — محفوظ ضمن البيانات المرفقة.` });
  return w;
}
