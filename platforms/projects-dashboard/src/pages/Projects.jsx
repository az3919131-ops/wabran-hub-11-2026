import { useMemo, useState } from 'react';
import { Building2, Banknote, Calculator, HardHat, Gauge, Coins, BadgeCheck, ListChecks, Hourglass, CalendarClock, LayoutGrid, Table2, Download, RotateCcw, Sparkles, CheckCircle2, PieChart as PieIcon, BarChart3, Trophy, FileText, Package, Wrench, Filter, Link2 } from 'lucide-react';
import { projectRows, projectKpis, totalsCheck, executiveSummary, countBy, ratioBucket, RATIO_BUCKETS, statusTone, collectionModel, fmtSAR, fmtM, fmtPct, fmtDate, fmtNum, isNum, cellText } from '../lib/analytics.js';
import { rowsToObjects, exportSheets, normAr } from '../lib/parse.js';
import { Kpi, Panel, Badge, Progress, Drawer, DataTable, SearchBox, Select, Donut, Bars, FieldList, NoReport, TONES } from '../components/ui.jsx';

const EMPTY = { q: '', type: '', status: '', bucket: '', materials: '', claim: '', uds: '', remaining: '', min: '', max: '', remainingText: '' };
const toneHex = (s) => TONES[statusTone(s)].hex;
const uniq = (list, f) => [...new Set(list.map((p) => p[f]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));

export default function Projects({ ctx }) {
  const { current, prev, role } = ctx;
  const all = useMemo(() => projectRows(current?.projects_data), [current]);
  const [f, setF] = useState(EMPTY);
  const [view, setView] = useState('cards');
  const [sel, setSel] = useState(null);
  const [metric, setMetric] = useState('invoice');
  const set = (k, v) => setF((s) => ({ ...s, [k]: s[k] === v ? '' : v }));
  const setVal = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const list = useMemo(() => {
    const q = normAr(f.q);
    return all.filter((p) =>
      (!q || normAr(`${p.name} ${p.wo} ${p.type}`).includes(q)) &&
      (!f.type || p.type === f.type) &&
      (!f.status || (p.status || 'غير محدد') === f.status) &&
      (!f.bucket || ratioBucket(p.ratio) === f.bucket) &&
      (!f.materials || (p.materials || 'غير محدد') === f.materials) &&
      (!f.claim || (p.claim || 'غير محدد') === f.claim) &&
      (!f.uds || (p.uds || 'غير محدد') === f.uds) &&
      (!f.remaining || (f.remaining === 'yes' ? p.hasRemaining : !p.hasRemaining)) &&
      (!f.remainingText || p.remaining === f.remainingText) &&
      (f.min === '' || (isNum(p.invoice ?? p.est) && (p.invoice ?? p.est) >= +f.min)) &&
      (f.max === '' || (isNum(p.invoice ?? p.est) && (p.invoice ?? p.est) <= +f.max))
    );
  }, [all, f]);

  const k = useMemo(() => projectKpis(list), [list]);
  const kAll = useMemo(() => projectKpis(all), [all]);
  const checks = useMemo(() => totalsCheck(current?.projects_data), [current]);
  const summary = useMemo(() => (current ? executiveSummary(current, prev) : []), [current, prev]);
  const coll = useMemo(() => collectionModel(current?.collections_data).blocks[0], [current]);
  const active = Object.values(f).some(Boolean);

  if (!current) return <NoReport role={role} />;
  const pd = current.projects_data;

  const charts = {
    status: countBy(list, 'status').map((d) => ({ ...d, color: toneHex(d.name) })),
    bucket: RATIO_BUCKETS.map((b) => ({ name: b, value: list.filter((p) => ratioBucket(p.ratio) === b).length, color: b === 'أكبر من 100%' ? '#7c3aed' : b === '100%' ? '#10B981' : b === 'غير محددة' ? '#94a3b8' : undefined })).filter((d) => d.value),
    cost: list.filter((p) => isNum(p.est) || isNum(p.exec)).map((p) => ({ name: p.name || p.wo, wo: p.wo, est: p.est || 0, exec: p.exec || 0 })),
    top: [...list].filter((p) => isNum(p[metric])).sort((a, b) => b[metric] - a[metric]).slice(0, 10).map((p) => ({ name: p.name || p.wo, value: p[metric], color: '#0F2537' })),
    claim: countBy(list, 'claim').map((d) => ({ ...d, color: d.name === 'غير محدد' ? '#cbd5e1' : toneHex(d.name) })),
    materials: countBy(list, 'materials').map((d) => ({ ...d, color: d.name === 'غير محدد' ? '#cbd5e1' : toneHex(d.name) })),
    remaining: countBy(list.filter((p) => p.hasRemaining), 'remaining').slice(0, 12).map((d) => ({ ...d, color: '#F59E0B' })),
  };

  const doExport = () => {
    const ids = new Set(list.map((p) => p._row));
    const rows = pd.rows.filter((r) => ids.has(r._row));
    exportSheets([{ name: 'المشاريع', rows: rowsToObjects(pd.columns, rows) }], `مشاريع_اكبر_من_100_${current.report_date}${active ? '_مفلتر' : ''}.xlsx`);
  };

  const supportFor = (p) => {
    const out = [];
    if (!p?.wo) return out;
    for (const b of collectionModel(current.collections_data).blocks)
      for (const r of b.rows) if (r.wo === p.wo) out.push({ src: `خطة التحصيل — ${b.title}`, columns: b.columns, row: r });
    for (const s of current.supporting_data?.sheets || [])
      for (const b of s.blocks) {
        const woCol = b.columns.find((c) => normAr(c.label) === 'رقم امر العمل')?.col;
        if (woCol) for (const r of b.rows) if (String(r.cells[woCol]) === p.wo) out.push({ src: s.name.trim(), columns: b.columns, row: r });
      }
    return out;
  };

  return (
    <div className="space-y-5">
      {/* الملخص التنفيذي */}
      <Panel title="الملخص التنفيذي للأسبوع" icon={Sparkles} actions={<span className="text-[11px] text-slate-500">تقرير {fmtDate(current.report_date)} · يتولد تلقائياً من البيانات</span>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.map((s) => (
            <div key={s.title} className={`rounded-xl border-r-4 p-3 ${{ good: 'border-green-500 bg-green-50/60', warn: 'border-orange-400 bg-orange-50/60', bad: 'border-red-500 bg-red-50/60', info: 'border-petrol-500 bg-cyan-50/50' }[s.tone]}`}>
              <div className="mb-1 text-xs font-bold text-navy-900">{s.title}</div>
              <div className="text-[13px] leading-6 text-slate-700">{s.text}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* المؤشرات */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={Building2} label="إجمالي عدد المشاريع" value={fmtNum(k.count)} sub={active ? `من أصل ${kAll.count} (مفلتر)` : pd.sheet} />
        <Kpi icon={Banknote} tone="blue" label="إجمالي الأجور طبقاً للفواتير" value={fmtM(k.invoice)} sub={`ر.س · ${k.invoiceN} مشروعاً لها قيمة`} />
        <Kpi icon={Calculator} tone="navy" label="تكلفة العمالة التقديرية" value={fmtM(k.est)} sub={`ر.س · ${k.estN} مشروعاً`} />
        <Kpi icon={HardHat} tone="blue" label="تكلفة العمالة حسب المنفذ" value={fmtM(k.exec)} sub={`ر.س · ${k.execN} مشروعاً`} />
        <Kpi icon={Gauge} tone={k.ratio > 1 ? 'purple' : 'green'} label="نسبة التنفيذ المالية الإجمالية" value={fmtPct(k.ratio)} sub="إجمالي المنفذ ÷ إجمالي التقديري" />
        <Kpi icon={Coins} tone="green" label="إجمالي الصرف الجزئي" value={fmtM(k.partial)} sub={`ر.س · ${k.partialN} مشروعاً`} />
        <Kpi icon={BadgeCheck} tone="green" label="إجمالي الصرف النهائي المسجل" value={k.finalN ? fmtM(k.final) : '0'} sub={k.finalN ? `ر.س · ${k.finalN} مشروعاً` : 'لا توجد مبالغ مسجلة في الملف'} />
        <Kpi icon={Hourglass} tone="orange" label="مشاريع لديها أعمال متبقية" value={fmtNum(k.remainingN)} sub="اضغط للفلترة" onClick={() => set('remaining', 'yes')} active={f.remaining === 'yes'} />
        <Kpi icon={Trophy} tone="purple" label="نسبة تنفيذ أكبر من 100%" value={fmtNum(k.over100)} sub="اضغط للفلترة" onClick={() => set('bucket', 'أكبر من 100%')} active={f.bucket === 'أكبر من 100%'} />
        <Kpi icon={CalendarClock} tone="slate" label="تاريخ آخر تحديث" value={fmtDate(current.report_date)} sub={`رُفع ${new Date(current.uploaded_at).toLocaleString('ar-SA-u-ca-gregory-nu-latn')}`} />
      </div>

      {/* المشاريع حسب موقف التنفيذ + مطابقة الإجماليات */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="عدد المشاريع حسب موقف التنفيذ" icon={ListChecks} className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {k.byStatus.map((s) => (
              <button key={s.name} onClick={() => set('status', s.name)} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition hover:shadow ${f.status === s.name ? 'border-petrol-500 bg-cyan-50' : 'border-slate-200'}`}>
                <span className="h-3 w-3 rounded-full" style={{ background: toneHex(s.name) }} />
                <span className="text-sm font-semibold text-slate-700">{s.name}</span>
                <span className="text-xl font-bold text-navy-900">{s.value}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="مطابقة الإجماليات مع صف الإجمالي في Excel" icon={CheckCircle2}>
          {checks.length ? (
            <ul className="space-y-1.5 text-xs">
              {checks.map((c) => (
                <li key={c.field} className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="flex items-center gap-2 tabular-nums font-bold">{fmtNum(c.calc)} <Badge tone={c.ok ? 'green' : 'red'}>{c.ok ? 'مطابق' : `Excel: ${fmtNum(c.excel)}`}</Badge></span>
                </li>
              ))}
            </ul>
          ) : <div className="text-xs text-slate-500">لا يوجد صف إجمالي في الشيت.</div>}
        </Panel>
      </div>

      {/* الفلاتر */}
      <Panel title="الفلاتر" icon={Filter} actions={<>
        {active && <Badge tone="blue">{list.length} من {all.length}</Badge>}
        <button className="btn-ghost" onClick={() => setF(EMPTY)} disabled={!active}><RotateCcw size={15} />إعادة ضبط</button>
      </>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-500">اسم المشروع / رقم أمر العمل</span><SearchBox value={f.q} onChange={setVal('q')} /></div>
          <Select label="نوع أمر العمل" value={f.type} onChange={setVal('type')} options={uniq(all, 'type')} />
          <Select label="موقف التنفيذ" value={f.status} onChange={setVal('status')} options={uniq(all, 'status')} />
          <Select label="نسبة التنفيذ" value={f.bucket} onChange={setVal('bucket')} options={RATIO_BUCKETS} />
          <Select label="الأعمال المتبقية" value={f.remaining} onChange={setVal('remaining')} options={[{ value: 'yes', label: 'لديها أعمال متبقية' }, { value: 'no', label: 'بدون أعمال متبقية' }]} />
          <Select label="موقف المواد" value={f.materials} onChange={setVal('materials')} options={[...uniq(all, 'materials'), 'غير محدد']} />
          <Select label="موقف المستخلص" value={f.claim} onChange={setVal('claim')} options={[...uniq(all, 'claim'), 'غير محدد']} />
          <Select label="موقف UDS" value={f.uds} onChange={setVal('uds')} options={[...uniq(all, 'uds'), 'غير محدد']} />
          <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">القيمة من (ر.س)</span><input type="number" className="input" value={f.min} onChange={(e) => setVal('min')(e.target.value)} placeholder="0" /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">القيمة إلى (ر.س)</span><input type="number" className="input" value={f.max} onChange={(e) => setVal('max')(e.target.value)} placeholder="∞" /></label>
          {f.remainingText && <div className="flex items-end"><Badge tone="orange">متبقي: {f.remainingText}</Badge></div>}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">فلتر القيمة يستخدم الأجور طبقاً للفاتورة، وإن لم تتوفر فالتكلفة التقديرية. الضغط على أي رسم بياني يفلتر المشاريع.</p>
      </Panel>

      {/* الرسوم */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="توزيع المشاريع حسب موقف التنفيذ" icon={PieIcon}><Donut data={charts.status} onSelect={(v) => set('status', v)} active={f.status} /></Panel>
        <Panel title="توزيع المشاريع حسب نسبة التنفيذ" icon={BarChart3}><Bars data={charts.bucket} bars={[{ key: 'value', label: 'عدد المشاريع', color: '#0F2537' }]} onSelect={(v) => set('bucket', v)} active={f.bucket} labels /></Panel>
        <Panel title="توزيع المشاريع حسب موقف المستخلصات" icon={FileText}><Donut data={charts.claim} onSelect={(v) => set('claim', v)} active={f.claim} /></Panel>
        <Panel title="مقارنة تكلفة العمالة التقديرية بالمنفذة" icon={BarChart3} className="lg:col-span-2" bodyClass="p-4 overflow-x-auto">
          <div style={{ minWidth: Math.max(600, charts.cost.length * 46) }}>
            <Bars data={charts.cost} money height={340} onSelect={(n) => setSel(list.find((p) => (p.name || p.wo) === n))} bars={[{ key: 'est', label: 'التقديرية', color: '#0F2537' }, { key: 'exec', label: 'حسب المنفذ', color: '#F37021' }]} />
          </div>
        </Panel>
        <Panel title="توزيع المشاريع حسب موقف المواد" icon={Package}><Donut data={charts.materials} onSelect={(v) => set('materials', v)} active={f.materials} /></Panel>
        <Panel title="أكبر 10 مشاريع من حيث القيمة" icon={Trophy} className="lg:col-span-2 xl:col-span-1" actions={
          <select className="input w-auto py-1 text-xs" value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="invoice">الأجور طبقاً للفاتورة</option><option value="est">التكلفة التقديرية</option><option value="exec">التكلفة المنفذة</option>
          </select>}>
          <Bars data={charts.top} horizontal money labels bars={[{ key: 'value', label: 'القيمة', color: '#0F2537' }]} onSelect={(n) => setSel(list.find((p) => (p.name || p.wo) === n))} />
        </Panel>
        <Panel title="المشاريع التي لديها أعمال متبقية (حسب نوع العمل المتبقي)" icon={Wrench} className="lg:col-span-2">
          <Bars data={charts.remaining} horizontal labels bars={[{ key: 'value', label: 'عدد المشاريع', color: '#F59E0B' }]} onSelect={(v) => set('remainingText', v)} active={f.remainingText} />
        </Panel>
      </div>

      {/* المشاريع */}
      <Panel title={`المشاريع (${list.length})`} icon={Building2} actions={<>
        <div className="flex rounded-xl border border-slate-200 p-0.5">
          <button className={`btn px-2.5 py-1.5 ${view === 'cards' ? 'bg-navy-900 text-white' : ''}`} onClick={() => setView('cards')}><LayoutGrid size={15} />بطاقات</button>
          <button className={`btn px-2.5 py-1.5 ${view === 'table' ? 'bg-navy-900 text-white' : ''}`} onClick={() => setView('table')}><Table2 size={15} />جدول</button>
        </div>
        <button className="btn-ghost" onClick={doExport}><Download size={15} />تصدير Excel</button>
      </>}>
        {view === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((p) => <ProjectCard key={p._row} p={p} onClick={() => setSel(p)} />)}
          </div>
        ) : (
          <DataTable
            rows={list}
            onRow={setSel}
            rowKey={(p) => p._row}
            columns={[
              { key: 'wo', label: 'رقم أمر العمل', num: true },
              { key: 'name', label: 'اسم المشروع', className: 'font-semibold min-w-44' },
              { key: 'type', label: 'نوع أمر العمل', className: 'min-w-36' },
              { key: 'status', label: 'موقف التنفيذ', render: (p) => <Badge tone={statusTone(p.status)}>{p.status || 'غير محدد'}</Badge>, value: (p) => p.status },
              { key: 'invoice', label: 'الأجور طبقاً للفاتورة', num: true, render: (p) => fmtNum(p.invoice) },
              { key: 'est', label: 'التقديرية', num: true, render: (p) => (isNum(p.est) ? fmtNum(p.est) : p.notes[0] || '—') },
              { key: 'exec', label: 'حسب المنفذ', num: true, render: (p) => fmtNum(p.exec) },
              { key: 'ratio', label: 'نسبة التنفيذ', render: (p) => <div className="w-28"><Progress value={p.ratio} /></div>, value: (p) => p.ratio },
              { key: 'claim', label: 'موقف المستخلص' },
              { key: 'materials', label: 'موقف المواد' },
              { key: 'uds', label: 'موقف UDS', className: 'min-w-40' },
              { key: 'remaining', label: 'الأعمال المتبقية', className: 'min-w-44' },
              { key: 'done', label: 'الأعمال المنتهية', className: 'min-w-44' },
            ]}
          />
        )}
      </Panel>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.name || 'بدون اسم'} — ${sel.wo || ''}` : ''}>
        {sel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="التقديرية" value={isNum(sel.est) ? fmtSAR(sel.est) : sel.notes[0] || '—'} />
              <MiniStat label="حسب المنفذ" value={fmtSAR(sel.exec)} />
              <MiniStat label="الأجور طبقاً للفاتورة" value={fmtSAR(sel.invoice)} />
              <div className="rounded-xl bg-slate-50 p-3"><div className="mb-1 text-[11px] text-slate-500">نسبة التنفيذ (مالية)</div><Progress value={sel.ratio} /></div>
            </div>
            {sel.sharedWith && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">القيم المالية لهذا الصف مدمجة مع صف آخر في Excel ({sel.sharedWith}) ومحسوبة مرة واحدة.</div>}
            <h4 className="text-sm font-bold text-navy-900">كل البيانات الأصلية (صف {sel._row} في الشيت)</h4>
            <FieldList columns={pd.columns} row={sel} />
            {supportFor(sel).map((s, i) => (
              <div key={i}>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy-900"><Link2 size={15} className="text-petrol-600" />{s.src}</h4>
                <FieldList columns={s.columns} row={s.row} />
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="text-sm font-bold text-navy-900">{value}</div></div>
);

function ProjectCard({ p, onClick }) {
  const tone = statusTone(p.status);
  const Row = ({ l, v, t }) => (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="shrink-0 text-slate-500">{l}</span>
      {t ? <Badge tone={statusTone(v)} className="max-w-[65%] truncate">{v || 'غير محدد'}</Badge> : <span className="truncate text-left font-semibold text-navy-900" title={cellText(v)}>{v ?? '—'}</span>}
    </div>
  );
  return (
    <button onClick={onClick} className="card fade-in group relative overflow-hidden p-4 text-right transition hover:-translate-y-0.5 hover:shadow-lg">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: TONES[tone].hex }} />
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold leading-snug text-navy-900">{p.name || <span className="text-slate-400">بدون اسم</span>}</h4>
          <div className="mt-0.5 text-[11px] text-slate-500"><span className="font-bold tabular-nums text-petrol-700">{p.wo}</span>{p.type && ` · ${p.type}`}</div>
        </div>
        <Badge tone={tone} className="shrink-0">{p.status || 'غير محدد'}</Badge>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-50 p-2 text-center">
        <div><div className="text-[10px] text-slate-500">الفاتورة</div><div className="text-xs font-bold">{fmtM(p.invoice)}</div></div>
        <div><div className="text-[10px] text-slate-500">التقديرية</div><div className="text-xs font-bold">{isNum(p.est) ? fmtM(p.est) : <span className="text-[10px] text-orange-600">{p.notes[0] ? 'مقفل ماليا' : '—'}</span>}</div></div>
        <div><div className="text-[10px] text-slate-500">المنفذ</div><div className="text-xs font-bold">{fmtM(p.exec)}</div></div>
      </div>
      <Progress value={p.ratio} className="mb-3" />
      <div className="space-y-1.5">
        <Row l="المستخلص" v={p.claim} t />
        <Row l="المواد" v={p.materials} t />
        <Row l="UDS" v={p.uds} t />
        <Row l="المنتهية" v={p.done} />
        <div className="flex items-start justify-between gap-2 text-xs">
          <span className="shrink-0 text-slate-500">المتبقية</span>
          <span className={`truncate text-left font-semibold ${p.hasRemaining ? 'text-orange-600' : 'text-green-700'}`} title={p.remaining || ''}>{p.remaining || '—'}</span>
        </div>
      </div>
    </button>
  );
}
