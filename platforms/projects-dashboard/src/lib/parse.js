// قراءة ملف Excel وتحويل كل شيت إلى جداول (Blocks) مع الحفاظ على كل الخلايا الأصلية.
// لا تُخترع أي قيمة: الخلايا المدمجة تُعلَّم، الأرقام لا تُكرَّر، والأخطاء (#REF!) تُحفظ كما هي.
import * as XLSX from '@e965/xlsx';

export const normAr = (s) =>
  String(s ?? '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isTotalText = (v) => typeof v === 'string' && /^(ال)?اجمالي$/.test(normAr(v).replace(/\s/g, ''));
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// تحويل خلية SheetJS إلى قيمة بسيطة قابلة للحفظ في JSON
function cellValue(cell) {
  if (!cell || cell.v == null) return null;
  if (cell.t === 'e') return { err: cell.w || '#ERR' };
  if (cell.v instanceof Date) return isoDate(new Date(cell.v.getTime() + 12 * 3600e3)); // تجنب انزياح المنطقة الزمنية
  if (typeof cell.v === 'number') return Number.isFinite(cell.v) ? cell.v : null;
  if (typeof cell.v === 'boolean') return cell.v ? 'نعم' : 'لا';
  const s = String(cell.v).replace(/\s+$/g, '').replace(/^\s+/g, '');
  return s === '' ? null : s;
}

const colL = (c) => XLSX.utils.encode_col(c);
const has = (v) => v != null && v !== '';

function readGrid(ws) {
  if (!ws || !ws['!ref']) return { grid: [], merges: [], rows: 0, cols: 0 };
  const rg = XLSX.utils.decode_range(ws['!ref']);
  const rows = rg.e.r + 1, cols = rg.e.c + 1;
  let noCache = 0;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell?.f && cell.v == null) noCache++;
      return cellValue(cell);
    })
  );
  return { grid, merges: ws['!merges'] || [], rows, cols, noCache };
}

const strAt = (grid, r, c) => (r >= 0 && typeof grid[r]?.[c] === 'string' ? grid[r][c] : null);

/**
 * يحلل شيتاً كاملاً إلى:
 *  blocks: جداول تبدأ بصف عناوين يحتوي "رقم أمر العمل" (أو أول صف نصي إذا لم يوجد)
 *  side:   جدول جانبي له عناوين في صف العنوان خارج نطاق الجدول الرئيسي
 *  orphans: صفوف بيانات لا تتبع أي جدول (تحفظ كما هي)
 */
export function parseSheet(ws, name) {
  const { grid, merges, rows, cols, noCache } = readGrid(ws);
  const out = { name, blocks: [], side: null, orphans: [], merges: merges.length, noCache };
  if (!rows) return out;

  // خريطة الدمج: الخلية -> نطاق الدمج
  const mergeAt = {};
  for (const m of merges) {
    const ref = `${colL(m.s.c)}${m.s.r + 1}:${colL(m.e.c)}${m.e.r + 1}`;
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) mergeAt[`${r},${c}`] = { ...m, ref };
  }
  const topLeft = (r, c) => {
    const m = mergeAt[`${r},${c}`];
    return m ? grid[m.s.r][m.s.c] : grid[r][c];
  };

  // صفوف العناوين
  let headerRows = [];
  for (let r = 0; r < rows; r++)
    if (grid[r].some((v) => typeof v === 'string' && normAr(v) === 'رقم امر العمل')) headerRows.push(r);
  if (!headerRows.length) {
    const first = grid.findIndex((row) => row.filter((v) => typeof v === 'string').length >= 2);
    if (first >= 0) headerRows = [first];
  }

  const used = new Set(); // خلايا تمت معالجتها `${r},${c}`
  const sideCols = new Set();

  headerRows.forEach((h, bi) => {
    const tr = h - 1;
    const labelOf = (c) => {
      const m = mergeAt[`${h},${c}`];
      const hv = m ? topLeft(h, c) : grid[h][c];
      if (typeof hv === 'string') return hv;
      const tm = mergeAt[`${tr},${c}`];
      // عنوان من الصف الأعلى: فقط إذا كان مدمجاً رأسياً مع صف العناوين أو خلية مفردة غير مدمجة أفقياً
      if (tr >= 0 && typeof grid[tr][c] === 'string' && (!tm || tm.e.r >= h)) return grid[tr][c];
      if (tm && tm.e.r >= h && typeof topLeft(tr, c) === 'string') return topLeft(tr, c);
      return null;
    };
    // نطاق الجدول الرئيسي: يتوقف بعد 3 أعمدة متتالية بلا عنوان
    let start = -1, end = -1, gap = 0;
    for (let c = 0; c < cols; c++) {
      if (labelOf(c)) {
        if (start < 0) start = c;
        end = c; gap = 0;
      } else if (start >= 0 && ++gap >= 3) break;
    }
    if (start < 0) return;
    // عمود "م" في العمود السابق مباشرة بلا عنوان
    if (start > 0 && labelOf(start - 1) == null) {
      let nums = 0;
      for (let r = h + 1; r < Math.min(rows, h + 6); r++) if (typeof grid[r][start - 1] === 'number') nums++;
      if (nums >= 3) start -= 1;
    }
    const columns = [];
    let title = null;
    for (let c = start; c <= end; c++) {
      const label = labelOf(c);
      let group = null;
      if (tr >= 0) {
        const tm = mergeAt[`${tr},${c}`];
        const tv = tm ? topLeft(tr, c) : grid[tr][c];
        if (typeof tv === 'string' && tv !== label) {
          if (!title && (c <= start + 1 || (tm && tm.s.c <= start + 1))) title = tv;
          else if (tv !== title) group = tv;
        }
      }
      columns.push({ col: colL(c), label: label || (c === start && !label ? 'م' : `عمود ${colL(c)}`), group });
    }
    if (!title) {
      const prevH = headerRows[bi - 1] ?? -1;
      for (let r = tr; r > prevH && !title; r--) {
        for (let c = 0; c < cols; c++) {
          const v = grid[r][c];
          if (typeof v === 'string' && !columns.some((k) => k.group === v || k.label === v) && !(r === tr && c > end)) {
            title = v; used.add(`${r},${c}`); break;
          }
        }
      }
    }
    for (let c = 0; c < cols; c++) used.add(`${h},${c}`);

    // قيم إضافية في صف العنوان (مثل إجمالي بلا عنوان)
    const titleNotes = [];
    if (tr >= 0 && !headerRows.includes(tr)) {
      for (let c = 0; c < cols; c++) {
        const v = grid[tr][c];
        if (!has(v)) continue;
        const isLabel = typeof v === 'string' && (v === title || columns.some((k) => k.label === v || k.group === v));
        if (c > end && typeof v === 'string' && !mergeAt[`${tr},${c}`]?.e.r) {
          // عنوان جدول جانبي
          if (bi === 0) sideCols.add(c);
          continue;
        }
        if (!isLabel) titleNotes.push({ cell: `${colL(c)}${tr + 1}`, value: v });
        used.add(`${tr},${c}`);
      }
      for (let c = 0; c < cols; c++) if (!sideCols.has(c)) used.add(`${tr},${c}`);
    }

    // صفوف البيانات
    const nextTitle = headerRows[bi + 1] != null ? headerRows[bi + 1] - 1 : rows;
    const dataRows = [];
    let total = null;
    let started = false;
    for (let r = h + 1; r < nextTitle; r++) {
      const mainHas = columns.some((k) => has(grid[r][XLSX.utils.decode_col(k.col)]) || mergeAt[`${r},${XLSX.utils.decode_col(k.col)}`]);
      if (!mainHas) {
        if (started) break; // أول صف فارغ ينهي الجدول
        continue;
      }
      started = true;
      const row = { _row: r + 1, cells: {}, merged: {}, extras: {} };
      for (const k of columns) {
        const c = XLSX.utils.decode_col(k.col);
        const m = mergeAt[`${r},${c}`];
        let v = grid[r][c];
        if (m && (m.s.r !== r || m.s.c !== c)) {
          row.merged[k.col] = m.ref;
          // ننسخ النص فقط للصفوف المدمجة رأسياً، ولا ننسخ الأرقام حتى لا تتكرر في الإجماليات
          if (m.s.c === c && m.s.r !== r && typeof topLeft(r, c) === 'string') v = topLeft(r, c);
        } else if (m) row.merged[k.col] = m.ref;
        if (has(v)) row.cells[k.col] = v;
        used.add(`${r},${c}`);
      }
      const isTotal = columns.slice(0, 4).some((k) => isTotalText(topLeft(r, XLSX.utils.decode_col(k.col))));
      if (isTotal) { total = row; for (let c = 0; c < cols; c++) if (!sideCols.has(c) && has(grid[r][c])) { if (c < start || c > end) row.extras[colL(c)] = grid[r][c]; used.add(`${r},${c}`); } break; }
      dataRows.push(row);
    }
    out.blocks.push({ title, headerRow: h + 1, columns, rows: dataRows, total, titleNotes, start, end });
  });

  // الجدول الجانبي
  if (sideCols.size && out.blocks[0]) {
    const tr = out.blocks[0].headerRow - 2;
    const sc = [...sideCols].sort((a, b) => a - b);
    const side = { title: null, columns: sc.map((c) => ({ col: colL(c), label: grid[tr][c] })), rows: [] };
    for (let r = tr + 1; r < rows; r++) {
      const row = { _row: r + 1, cells: {}, merged: {} };
      for (const c of sc) {
        const m = mergeAt[`${r},${c}`];
        let v = grid[r][c];
        if (m) { row.merged[colL(c)] = m.ref; if (m.s.r !== r && typeof topLeft(r, c) === 'string') v = topLeft(r, c); }
        if (has(v)) row.cells[colL(c)] = v;
        used.add(`${r},${c}`);
      }
      if (Object.keys(row.cells).length) side.rows.push(row);
    }
    for (const c of sc) used.add(`${tr},${c}`);
    out.side = side;
  }

  // خلايا إضافية بلا عنوان داخل صفوف الجداول (مثل ملاحظات في أعمدة بعيدة)
  for (const b of out.blocks) {
    for (const row of b.rows) {
      const r = row._row - 1;
      for (let c = 0; c < cols; c++) {
        if (used.has(`${r},${c}`) || !has(grid[r][c])) continue;
        row.extras[colL(c)] = grid[r][c];
        used.add(`${r},${c}`);
      }
    }
  }
  // صفوف يتيمة
  for (let r = 0; r < rows; r++) {
    const cells = {};
    for (let c = 0; c < cols; c++) if (!used.has(`${r},${c}`) && has(grid[r][c])) cells[colL(c)] = grid[r][c];
    if (Object.keys(cells).length) out.orphans.push({ _row: r + 1, cells });
  }
  return out;
}

// ---------- تحديد الشيتات ----------
const findSheet = (names, test) => names.find((n) => test(normAr(n)));

export async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** يقرأ ملف Excel ويعيد كائن التقرير الجاهز للحفظ + التحذيرات */
export async function parseWorkbook(buf, fileName) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false, cellStyles: false });
  const names = wb.SheetNames;
  const errors = [], warnings = [];
  const pName = findSheet(names, (n) => /اكبر من ?100/.test(n)) || findSheet(names, (n) => n.includes('اكبر'));
  const cName = findSheet(names, (n) => n.includes('تحصيل'));
  if (!pName) errors.push('لم يتم العثور على شيت "مشاريع اكبر من 100".');
  if (!cName) errors.push('لم يتم العثور على شيت "خطة تحصيل محتملة".');

  const parsed = Object.fromEntries(names.map((n) => [n, parseSheet(wb.Sheets[n], n)]));
  const p = pName ? parsed[pName] : null;
  const c = cName ? parsed[cName] : null;
  if (p && !p.blocks.length) errors.push(`شيت "${pName}" لا يحتوي صف عناوين به "رقم أمر العمل".`);
  if (c && !c.blocks.length) errors.push(`شيت "${cName}" لا يحتوي صف عناوين به "رقم أمر العمل".`);

  for (const n of [pName, cName].filter(Boolean))
    if (parsed[n].noCache) warnings.push(`شيت "${n.trim()}": ${parsed[n].noCache} معادلة بدون قيمة محسوبة محفوظة — افتح الملف في Excel واحفظه ثم أعد الرفع.`);
  const supporting = names
    .filter((n) => n !== pName && n !== cName)
    .map((n) => parsed[n])
    .filter((s) => s.blocks.length || s.orphans.length);

  const report = {
    file_name: fileName,
    projects_data: p?.blocks.length ? { sheet: pName, ...p.blocks[0], extraBlocks: p.blocks.slice(1), orphans: p.orphans, merges: p.merges } : null,
    collections_data: c?.blocks.length ? { sheet: cName, blocks: c.blocks, side: c.side, orphans: c.orphans, merges: c.merges } : null,
    supporting_data: { sheetNames: names, sheets: supporting },
  };
  return { report, errors, warnings };
}

// ---------- التصدير إلى Excel ----------
const exportVal = (v) => (v && typeof v === 'object' ? v.err : v);
/** يحول صفوفاً خام إلى كائنات بالعناوين الأصلية (يحافظ على الترتيب ويميز العناوين المكررة) */
export function rowsToObjects(columns, rows, extra) {
  const seen = {};
  const labels = columns.map((c) => {
    const l = c.label.replace(/\s+/g, ' ').trim();
    seen[l] = (seen[l] || 0) + 1;
    return seen[l] > 1 ? `${l} (${c.col})` : l;
  });
  return rows.map((r) => {
    const o = {};
    columns.forEach((c, i) => (o[labels[i]] = exportVal(r.cells?.[c.col]) ?? ''));
    if (extra) Object.assign(o, extra(r));
    return o;
  });
}
/** sheets: [{ name, rows: [object] }] */
export function exportSheets(sheets, fileName) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  for (const s of sheets) {
    const ws = s.rows.length ? XLSX.utils.json_to_sheet(s.rows) : XLSX.utils.aoa_to_sheet([['لا توجد بيانات']]);
    const keys = Object.keys(s.rows[0] || {});
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(45, Math.max(10, k.length + 2, ...s.rows.slice(0, 50).map((r) => String(r[k] ?? '').length))) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  }
  XLSX.writeFile(wb, fileName);
}
