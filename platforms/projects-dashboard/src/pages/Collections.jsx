import { useMemo, useRef, useState } from 'react';
import { Wallet, Layers, Coins, Map as MapIcon, Hourglass, Scale, Trophy, Download, RotateCcw, Filter, BarChart3, PieChart as PieIcon, AlertTriangle, Info, Table2, Paperclip } from 'lucide-react';
import { collectionModel, countBy, statusTone, fmtSAR, fmtM, fmtNum, isNum, cellText } from '../lib/analytics.js';
import { rowsToObjects, exportSheets, normAr } from '../lib/parse.js';
import { Kpi, Panel, Badge, Drawer, DataTable, SearchBox, Select, Donut, Bars, FieldList, NoReport, PALETTE } from '../components/ui.jsx';

const EMPTY = { q: '', stage: '', status: '', gis: '' };
const short = (l) => l.replace(/\s+/g, ' ').trim();

export default function Collections({ ctx }) {
  const { current, role } = ctx;
  const model = useMemo(() => collectionModel(current?.collections_data), [current]);
  const [bi, setBi] = useState(0);
  const [f, setF] = useState(EMPTY);
  const [sel, setSel] = useState(null);
  const tableRef = useRef(null);
  const b = model.blocks[bi] || model.blocks[0];
  const setVal = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k, v) => setF((s) => ({ ...s, [k]: s[k] === v ? '' : v }));

  const rows = useMemo(() => {
    if (!b) return [];
    const q = normAr(f.q);
    return b.rows.filter((r) =>
      (!q || normAr(`${r.name} ${r.wo}`).includes(q)) &&
      (!f.stage || r.stages[f.stage] != null) &&
      (!f.status || (r.status || 'غير محدد') === f.status) &&
      (!f.gis || (r.gis || 'غير محدد') === f.gis)
    );
  }, [b, f]);

  if (!current) return <NoReport role={role} />;
  if (!b) return <div className="card p-6 text-sm text-slate-600">لا يوجد شيت خطة تحصيل في هذا التقرير.</div>;

  const active = Object.values(f).some(Boolean);
  const stageColor = (s, i) => (/موازن/.test(s.label) ? '#F59E0B' : /جاري تحصيل/.test(s.label) ? '#0F2537' : /منتهي/.test(s.label) ? '#10B981' : PALETTE[i % PALETTE.length]);
  const stagesF = b.stages.map((s, i) => ({ ...s, ftotal: rows.reduce((a, r) => a + (r.stages[s.col] || 0), 0), fcount: rows.filter((r) => r.stages[s.col] != null).length, color: stageColor(s, i) }));
  const findStage = (rx) => stagesF.find((s) => rx.test(normAr(s.label)));
  const collecting = findStage(/جاري تحصيل/);
  const balancing = findStage(/موازنه/);
  const top = [...rows].sort((a, c) => c.total - a.total).filter((r) => r.total > 0).slice(0, 10);
  const pickStage = (label) => {
    const s = b.stages.find((x) => short(x.label) === label);
    if (s) { toggle('stage', s.col); setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
  };
  const stageWarn = b.stages.filter((s) => (s.excel && typeof s.excel === 'object') || (isNum(s.excel) && Math.abs(s.excel - s.total) > 1));

  const doExport = () => {
    const ids = new Set(rows.map((r) => r._row));
    const src = current.collections_data.blocks[b.index];
    const sheets = [{ name: 'خطة التحصيل', rows: rowsToObjects(src.columns, src.rows.filter((r) => ids.has(r._row)), (r) => ({ ...Object.fromEntries(Object.entries(r.extras || {}).map(([c, v]) => [`عمود ${c}`, cellText(v)])), 'مجموع المراحل (محسوب)': b.rows.find((x) => x._row === r._row)?.total })) }];
    if (!active) sheets.push({ name: 'إجمالي المراحل', rows: b.stages.map((s) => ({ المرحلة: short(s.label), 'عدد المشاريع': s.count, 'المجموع المحسوب': s.total, 'إجمالي Excel': cellText(s.excel) })) });
    exportSheets(sheets, `خطة_التحصيل_${current.report_date}${active ? '_مفلتر' : ''}.xlsx`);
  };

  const statusOpts = [...new Set(b.rows.map((r) => r.status || 'غير محدد'))];
  const gisOpts = [...new Set(b.rows.map((r) => r.gis || 'غير محدد'))];

  return (
    <div className="space-y-5">
      {model.blocks.length > 1 && (
        <div className="no-print flex flex-wrap gap-2">
          {model.blocks.map((x, i) => (
            <button key={i} onClick={() => { setBi(i); setF(EMPTY); }} className={`btn ${i === bi ? 'bg-navy-900 text-white' : 'btn-ghost'}`}><Table2 size={15} />{x.title}</button>
          ))}
        </div>
      )}
      <div className="card flex flex-wrap items-center gap-3 border-r-4 border-r-petrol-600 p-4">
        <Wallet className="text-petrol-600" />
        <div className="flex-1">
          <div className="font-bold text-navy-900">{b.title}</div>
          <div className="text-[11px] text-slate-500">شيت "{current.collections_data.sheet.trim()}" · {b.rows.length} سجلاً · القيم محتملة/مخططة ولا تمثل تحصيلاً فعلياً إلا حيث تنص المرحلة على ذلك.</div>
        </div>
        <button className="btn-ghost no-print" onClick={doExport}><Download size={15} />تصدير Excel</button>
      </div>

      {(stageWarn.length > 0 || b.multiStage > 0 || b.dupes.length > 0) && (
        <div className="space-y-2">
          {stageWarn.map((s) => (
            <div key={s.col} className="flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>"{short(s.label)}": المجموع من الصفوف <b>{fmtNum(s.total)}</b> بينما إجمالي Excel {typeof s.excel === 'object' ? <b>{s.excel.err}</b> : <b>{fmtNum(s.excel)}</b>}{isNum(s.excel) && <> (فرق {fmtNum(s.total - s.excel)} — غالباً صف غير مشمول في معادلة الإجمالي)</>}. المنصة تعرض المجموع المحسوب من الصفوف.</span>
            </div>
          ))}
          {b.multiStage > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-cyan-50 p-3 text-xs text-petrol-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>{b.multiStage} مشروعاً موزعة قيمها على أكثر من مرحلة (أجزاء مختلفة من المستحقات وليست تكراراً لنفس المبلغ). تم التحقق: لا يتكرر أي أمر عمل داخل الجدول{b.dupes.length ? ` باستثناء ${b.dupes.join('، ')}` : ''}.</span>
            </div>
          )}
        </div>
      )}

      {/* المؤشرات */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Kpi icon={Coins} tone="green" label={`قيمة التحصيل الجزئي المسجلة (${b.partialLabel ? short(b.partialLabel) : 'جزئي'})`} value={fmtM(rows.reduce((a, r) => a + (r.partial || 0), 0))} sub={`ر.س · ${rows.filter((r) => r.partial != null).length} سجل`} />
        <Kpi icon={Layers} tone="navy" label="مجموع قيم المراحل (محسوب من الصفوف)" value={fmtM(stagesF.reduce((a, s) => a + s.ftotal, 0))} sub={`ر.س · ${rows.length} مشروعاً${isNum(b.excelGrand) ? ` · إجمالي Excel ${fmtM(b.excelGrand)}` : ''}`} />
        {collecting && <Kpi icon={Hourglass} tone="blue" label="المشاريع الجاري تحصيلها" value={fmtNum(collecting.fcount)} sub={`${fmtM(collecting.ftotal)} ر.س · ${short(collecting.label)}`} onClick={() => pickStage(short(collecting.label))} active={f.stage === collecting.col} />}
        {balancing && <Kpi icon={Scale} tone="orange" label="المشاريع الجاري موازنة موادها" value={fmtNum(balancing.fcount)} sub={`${fmtM(balancing.ftotal)} ر.س`} onClick={() => pickStage(short(balancing.label))} active={f.stage === balancing.col} />}
      </div>

      {/* بطاقات المراحل */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stagesF.map((s) => (
          <button key={s.col} onClick={() => pickStage(short(s.label))} className={`card fade-in relative overflow-hidden p-4 text-right transition hover:-translate-y-0.5 hover:shadow-lg ${f.stage === s.col ? 'ring-2 ring-petrol-500' : ''}`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
            <div className="min-h-10 whitespace-pre-line text-xs font-bold leading-5 text-slate-600">{s.label}</div>
            <div className="mt-2 text-2xl font-bold text-navy-900">{fmtM(s.ftotal)}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500"><span>ر.س</span><Badge tone="slate">{s.fcount} مشروع</Badge></div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="مقارنة قيم مراحل التحصيل" icon={BarChart3}>
          <Bars data={stagesF.map((s) => ({ name: short(s.label), value: s.ftotal, color: s.color }))} money labels bars={[{ key: 'value', label: 'القيمة' }]} onSelect={pickStage} active={b.stages.find((s) => s.col === f.stage) && short(b.stages.find((s) => s.col === f.stage).label)} height={320} />
        </Panel>
        <Panel title="توزيع القيم على المراحل" icon={PieIcon}>
          <Donut data={stagesF.filter((s) => s.ftotal > 0).map((s) => ({ name: short(s.label), value: s.ftotal, color: s.color }))} money onSelect={pickStage} height={260} />
        </Panel>
        <Panel title="أكبر 10 فرص تحصيل (مجموع قيم المشروع في المراحل)" icon={Trophy}>
          <Bars data={top.map((r) => ({ name: r.name || r.wo, value: r.total, color: '#0F2537' }))} horizontal money labels bars={[{ key: 'value', label: 'القيمة' }]} onSelect={(n) => setSel(rows.find((r) => (r.name || r.wo) === n))} />
        </Panel>
        <div className="space-y-4">
          <Panel title="موقف GIS" icon={MapIcon}><Donut data={countBy(rows, 'gis')} onSelect={(v) => toggle('gis', v)} active={f.gis} height={200} /></Panel>
          <Panel title="الموقف المالي / الملاحظات" icon={Info}><Donut data={countBy(rows, 'status')} onSelect={(v) => toggle('status', v)} active={f.status} height={200} /></Panel>
        </div>
      </div>

      <Panel title="الفلاتر" icon={Filter} actions={<><Badge tone="blue">{rows.length} من {b.rows.length}</Badge><button className="btn-ghost" disabled={!active} onClick={() => setF(EMPTY)}><RotateCcw size={15} />إعادة ضبط</button></>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="mb-1 block text-[11px] font-semibold text-slate-500">المشروع / رقم أمر العمل</span><SearchBox value={f.q} onChange={setVal('q')} /></div>
          <Select label="المرحلة" value={f.stage} onChange={setVal('stage')} options={b.stages.map((s) => ({ value: s.col, label: short(s.label) }))} />
          <Select label="الموقف المالي / الملاحظات" value={f.status} onChange={setVal('status')} options={statusOpts} />
          <Select label="موقف GIS" value={f.gis} onChange={setVal('gis')} options={gisOpts} />
        </div>
      </Panel>

      <div ref={tableRef}>
        <Panel title={`جدول خطة التحصيل${f.stage ? ` — ${short(b.stages.find((s) => s.col === f.stage).label)}` : ''}`} icon={Table2}>
          <DataTable
            rows={rows}
            onRow={setSel}
            rowKey={(r) => r._row}
            columns={[
              ...b.columns.filter((c) => b.rows.some((r) => r.cells[c.col] != null)).map((c) => {
                const st = b.stages.find((s) => s.col === c.col);
                return {
                  key: c.col,
                  label: short(c.label),
                  num: !!st || /رقم|جزئي/.test(c.label),
                  value: (r) => r.cells[c.col],
                  className: st && f.stage === c.col ? 'bg-cyan-50 font-bold' : /اسم/.test(c.label) ? 'font-semibold min-w-40' : '',
                  render: st ? (r) => (isNum(r.cells[c.col]) ? fmtNum(r.cells[c.col]) : r.cells[c.col] ? <Badge tone="red">{cellText(r.cells[c.col])}</Badge> : <span className="text-slate-300">—</span>) : /موقف/.test(c.label) ? (r) => (r.cells[c.col] ? <Badge tone={statusTone(r.cells[c.col])}>{cellText(r.cells[c.col])}</Badge> : <span className="text-slate-300">—</span>) : undefined,
                };
              }),
              { key: 'total', label: 'مجموع المراحل', num: true, render: (r) => <b>{fmtNum(r.total)}</b> },
              { key: 'extras', label: 'ملاحظات إضافية', value: (r) => Object.values(r.extras).map(cellText).join(' · ') },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-xs">
            {stagesF.map((s) => <span key={s.col}><span className="text-slate-500">{short(s.label)}:</span> <b className="tabular-nums">{fmtNum(s.ftotal)}</b></span>)}
          </div>
        </Panel>
      </div>

      {(model.side || model.orphans.length > 0 || b.titleNotes.length > 0) && (
        <Panel title="بيانات مرفقة بنفس الشيت (محفوظة كما هي)" icon={Paperclip}>
          <div className="grid gap-4 lg:grid-cols-2">
            {model.side && (
              <div>
                <div className="mb-2 text-xs font-bold text-slate-600">جدول جانبي: {model.side.columns.map((c) => short(c.label)).join(' / ')}</div>
                <DataTable maxH="max-h-80" rows={model.side.rows} rowKey={(r) => r._row} columns={[{ key: '_row', label: 'صف', num: true }, ...model.side.columns.map((c) => ({ key: c.col, label: short(c.label), value: (r) => r.cells[c.col], num: true }))]} />
              </div>
            )}
            <div className="space-y-3">
              {b.titleNotes.map((n) => <div key={n.cell} className="rounded-xl bg-slate-50 p-3 text-xs">قيمة بدون عنوان في الخلية <b>{n.cell}</b>: <b className="tabular-nums">{cellText(n.value)}</b></div>)}
              {model.orphans.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-bold text-slate-600">صفوف بدون عناوين أسفل الشيت</div>
                  <DataTable maxH="max-h-80" rows={model.orphans} rowKey={(r) => r._row} columns={[{ key: '_row', label: 'صف', num: true }, ...[...new Set(model.orphans.flatMap((o) => Object.keys(o.cells)))].sort().map((c) => ({ key: c, label: `عمود ${c}`, value: (r) => r.cells[c] }))]} />
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.name || ''} — ${sel.wo || ''}` : ''}>
        {sel && (
          <div className="space-y-4">
            <div className="rounded-xl bg-navy-900 p-4 text-white">
              <div className="text-xs text-slate-300">مجموع قيم المشروع في المراحل</div>
              <div className="text-2xl font-bold">{fmtSAR(sel.total)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{sel.stageList.map((s) => <span key={s.col} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{short(s.label)}: {fmtNum(sel.stages[s.col])}</span>)}</div>
            </div>
            {sel.errs.length > 0 && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{sel.errs.join(' · ')}</div>}
            <FieldList columns={b.columns} row={sel} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
