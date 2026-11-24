import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Archive, Download, Trash2, Loader2, TrendingUp, TrendingDown, Minus, Layers, Info } from 'lucide-react';
import { compareReports, countBy, fmtNum, fmtPct, fmtSAR, fmtDate, cellText, isNum } from '../lib/analytics.js';
import { exportSheets } from '../lib/parse.js';
import { supabase } from '../lib/supabase.js';
import { Panel, Badge, DataTable, NoReport, Empty } from '../components/ui.jsx';

const BADGE_TONE = { 'جديد': 'blue', 'تقدم': 'green', 'تغير الموقف': 'orange', 'تحديث بيانات': 'purple', 'بدون تغيير': 'slate', 'غير موجود بالتقرير الحالي': 'red' };
const fmtBy = (t, v) => (t === 'sar' ? fmtSAR(v) : t === 'pct' ? fmtPct(v) : fmtNum(v));
const showVal = (f, v) => (v == null ? '—' : f === 'ratio' ? fmtPct(v) : isNum(v) ? fmtNum(v) : cellText(v));

export default function Compare({ ctx }) {
  const { list, current, role, local, loadFull, cache, onDeleted } = ctx;
  const [aId, setA] = useState('');
  const [bId, setB] = useState('');
  const [A, setRA] = useState(null);
  const [B, setRB] = useState(null);
  const [busy, setBusy] = useState(false);
  const [badge, setBadge] = useState('');

  useEffect(() => {
    // الافتراضي: التقرير المعروض مقابل التقرير الذي يسبقه
    const i = Math.max(0, list.findIndex((r) => r.id === current?.id));
    setB(list[i]?.id || '');
    setA(list[i + 1]?.id || '');
  }, [list, current?.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      try {
        const [x, y] = await Promise.all([aId ? cache[aId] || loadFull(aId) : null, bId ? cache[bId] || loadFull(bId) : null]);
        if (alive) { setRA(x || null); setRB(y || null); }
      } finally { alive && setBusy(false); }
    })();
    return () => { alive = false; };
  }, [aId, bId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cmp = useMemo(() => (A && B && A.id !== B.id ? compareReports(A, B) : null), [A, B]);
  const items = cmp ? cmp.items.filter((i) => !badge || i.badge === badge) : [];

  const del = async (r) => {
    if (!confirm(`حذف تقرير ${fmtDate(r.report_date)} (${r.file_name}) نهائياً؟`)) return;
    if (!local) {
      const { error } = await supabase.from('weekly_reports').delete().eq('id', r.id);
      if (error) return alert('تعذر الحذف: ' + error.message);
    }
    onDeleted(r.id);
  };

  const doExport = () => {
    if (!cmp) return;
    exportSheets([
      { name: 'المؤشرات', rows: cmp.metrics.map(([l, a, b, t]) => ({ المؤشر: l, 'الأسبوع السابق': a ?? '', 'الأسبوع الحالي': b ?? '', الفرق: isNum(a) && isNum(b) ? (t === 'pct' ? +((b - a) * 100).toFixed(2) + '%' : b - a) : '' })) },
      { name: 'المشاريع', rows: cmp.items.map((i) => ({ 'رقم أمر العمل': i.wo, 'اسم المشروع': i.name || '', الحالة: i.badge, التغييرات: i.changes.map((c) => `${c.label}: ${showVal(c.field, c.from)} ← ${showVal(c.field, c.to)}`).join(' | ') })) },
      { name: 'مراحل التحصيل', rows: cmp.stageChanges.map((s) => ({ 'رقم أمر العمل': s.wo, 'اسم المشروع': s.name || '', 'المرحلة السابقة': s.from, 'المرحلة الحالية': s.to, 'القيمة السابقة': s.fromTotal ?? '', 'القيمة الحالية': s.toTotal, 'الموقف السابق': s.fromStatus || '', 'الموقف الحالي': s.toStatus || '' })) },
    ], `مقارنة_${A.report_date}_${B.report_date}.xlsx`);
  };

  if (!current) return <NoReport role={role} />;
  const opts = list.map((r) => <option key={r.id} value={r.id}>{fmtDate(r.report_date)} — {r.file_name}</option>);

  return (
    <div className="space-y-5">
      <Panel title="مقارنة تقريرين" icon={GitCompareArrows} actions={cmp && <button className="btn-ghost" onClick={doExport}><Download size={15} />تصدير المقارنة Excel</button>}>
        {list.length < 2 ? (
          <div className="flex items-start gap-2 rounded-xl bg-cyan-50 p-4 text-sm text-petrol-700">
            <Info size={18} className="mt-0.5 shrink-0" />
            <span>يوجد تقرير واحد فقط ({fmtDate(current.report_date)}). ستظهر المقارنات تلقائياً بعد استيراد تقرير الأسبوع التالي — لا تُنشأ مقارنات بدون تقرير سابق.</span>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">الأسبوع السابق<select className="input mt-1" value={aId} onChange={(e) => setA(e.target.value)}><option value="">اختر</option>{opts}</select></label>
            <label className="text-xs font-semibold text-slate-500">الأسبوع الحالي<select className="input mt-1" value={bId} onChange={(e) => setB(e.target.value)}><option value="">اختر</option>{opts}</select></label>
          </div>
        )}
        {busy && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />جاري التحميل…</div>}
        {aId && aId === bId && <div className="mt-3 text-xs text-orange-700">اختر تقريرين مختلفين.</div>}
      </Panel>

      {cmp && (
        <>
          {(cmp.dupA.length > 0 || cmp.dupB.length > 0) && (
            <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-800">أوامر عمل مكررة داخل التقرير (استُخدم أول ظهور للمقارنة): {[...new Set([...cmp.dupA, ...cmp.dupB])].join('، ')}</div>
          )}
          <Panel title="التغيرات المالية والرقمية" icon={Layers}>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full">
                <thead><tr><th className="th">المؤشر</th><th className="th">الأسبوع السابق ({fmtDate(A.report_date)})</th><th className="th">الأسبوع الحالي ({fmtDate(B.report_date)})</th><th className="th">الفرق</th></tr></thead>
                <tbody>
                  {cmp.metrics.map(([l, a, b, t]) => {
                    const d = isNum(a) && isNum(b) ? b - a : null;
                    return (
                      <tr key={l} className="odd:bg-slate-50/50">
                        <td className="td font-semibold">{l}</td>
                        <td className="td tabular-nums">{fmtBy(t, a)}</td>
                        <td className="td tabular-nums">{fmtBy(t, b)}</td>
                        <td className={`td tabular-nums font-bold ${d > 0 ? 'text-green-700' : d < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          <span className="inline-flex items-center gap-1">
                            {d > 0 ? <TrendingUp size={14} /> : d < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                            {d == null ? '—' : t === 'pct' ? `${(d * 100).toFixed(2)} نقطة` : (d > 0 ? '+' : '') + fmtNum(d)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="حالة المشاريع" icon={GitCompareArrows} actions={badge && <button className="btn-ghost" onClick={() => setBadge('')}>عرض الكل</button>}>
            <div className="mb-4 flex flex-wrap gap-2">
              {countBy(cmp.items, 'badge').map((c) => (
                <button key={c.name} onClick={() => setBadge(badge === c.name ? '' : c.name)} className={`rounded-xl border px-3 py-2 text-right transition hover:shadow ${badge === c.name ? 'border-petrol-500 bg-cyan-50' : 'border-slate-200'}`}>
                  <Badge tone={BADGE_TONE[c.name]}>{c.name}</Badge>
                  <span className="mr-2 text-lg font-extrabold text-navy-900">{c.value}</span>
                </button>
              ))}
            </div>
            <p className="mb-3 text-[11px] text-slate-500">الربط بين الأسابيع برقم أمر العمل. اختفاء مشروع من التقرير الحالي لا يعني اكتماله.</p>
            <DataTable
              rows={items}
              rowKey={(i) => i.wo}
              columns={[
                { key: 'wo', label: 'رقم أمر العمل', num: true },
                { key: 'name', label: 'اسم المشروع', className: 'font-semibold min-w-40' },
                { key: 'badge', label: 'الحالة', render: (i) => <Badge tone={BADGE_TONE[i.badge]}>{i.badge}</Badge> },
                {
                  key: 'changes', label: 'التغييرات', value: (i) => i.changes.length,
                  render: (i) => i.changes.length ? (
                    <ul className="space-y-1 text-xs">
                      {i.changes.map((c) => (
                        <li key={c.field}><span className="font-semibold text-slate-600">{c.label}:</span> <span className="text-slate-400 line-through decoration-slate-300">{showVal(c.field, c.from)}</span> ← <span className="font-bold text-navy-900">{showVal(c.field, c.to)}</span>
                          {c.diff != null && <span className={`mr-1 font-bold ${c.diff > 0 ? 'text-green-700' : 'text-red-600'}`}>({c.diff > 0 ? '+' : ''}{c.field === 'ratio' ? `${(c.diff * 100).toFixed(1)}%` : fmtNum(c.diff)})</span>}
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-xs text-slate-400">—</span>,
                },
              ]}
            />
          </Panel>

          <Panel title="تغير مراحل التحصيل" icon={Layers}>
            {cmp.stageChanges.length ? (
              <DataTable
                rows={cmp.stageChanges}
                rowKey={(s) => s.wo}
                columns={[
                  { key: 'wo', label: 'رقم أمر العمل', num: true },
                  { key: 'name', label: 'اسم المشروع', className: 'font-semibold' },
                  { key: 'from', label: 'المراحل السابقة', className: 'text-xs' },
                  { key: 'to', label: 'المراحل الحالية', className: 'text-xs', render: (s) => <>{s.isNew && <Badge tone="blue" className="ml-1">جديد</Badge>}{s.to || '—'}</> },
                  { key: 'fromTotal', label: 'القيمة السابقة', num: true, render: (s) => fmtNum(s.fromTotal) },
                  { key: 'toTotal', label: 'القيمة الحالية', num: true, render: (s) => fmtNum(s.toTotal) },
                  { key: 'toStatus', label: 'الموقف', render: (s) => (s.fromStatus !== s.toStatus ? <span className="text-xs"><span className="text-slate-400">{s.fromStatus || '—'}</span> ← <b>{s.toStatus || '—'}</b></span> : s.toStatus || '—') },
                ]}
              />
            ) : <Empty text="لا توجد تغيرات في مراحل التحصيل" />}
          </Panel>
        </>
      )}

      <Panel title={`الأرشيف الأسبوعي (${list.length})`} icon={Archive}>
        <DataTable
          rows={list}
          rowKey={(r) => r.id}
          columns={[
            { key: 'report_date', label: 'تاريخ التقرير', render: (r) => <b>{fmtDate(r.report_date)}</b> },
            { key: 'file_name', label: 'اسم الملف', className: 'text-xs' },
            { key: 'uploaded_at', label: 'تاريخ الرفع', render: (r) => new Date(r.uploaded_at).toLocaleString('ar-SA-u-ca-gregory-nu-latn') },
            { key: 'cur', label: '', render: (r) => (r.id === current.id ? <Badge tone="green">المعروض حالياً</Badge> : null) },
            ...(role === 'admin' ? [{ key: 'del', label: 'إجراء', render: (r) => <button className="btn text-red-600 hover:bg-red-50" onClick={() => del(r)}><Trash2 size={15} />حذف</button> }] : []),
          ]}
        />
      </Panel>
    </div>
  );
}
