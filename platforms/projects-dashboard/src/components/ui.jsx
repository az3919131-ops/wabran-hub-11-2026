// مكونات مشتركة بين الصفحات
import { useMemo, useState } from 'react';
import { X, ArrowUpDown, Search, Inbox } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList } from 'recharts';
import { fmtM, fmtPct, isNum, cellText } from '../lib/analytics.js';

export const TONES = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', hex: '#10B981' },
  orange: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', hex: '#F59E0B' },
  red: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', hex: '#EF4444' },
  blue: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', hex: '#0EA5E9' },
  navy: { bg: 'bg-slate-100', text: 'text-navy-900', ring: 'ring-slate-300', hex: '#0F2537' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200', hex: '#94a3b8' },
  purple: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', hex: '#7c3aed' },
};
export const PALETTE = ['#0F2537', '#F37021', '#C89B6E', '#0EA5E9', '#10B981', '#F59E0B', '#7c3aed', '#EF4444', '#64748b', '#16324A', '#D95E16', '#be185d'];

export function Badge({ tone = 'slate', children, className = '' }) {
  const t = TONES[tone] || TONES.slate;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${t.bg} ${t.text} ${t.ring} ${className}`}>{children}</span>;
}

export function Kpi({ icon: Icon, label, value, sub, tone = 'navy', onClick, active }) {
  const t = TONES[tone] || TONES.navy;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`card fade-in group relative overflow-hidden p-4 text-right transition disabled:cursor-default ${onClick ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''} ${active ? 'ring-2 ring-petrol-500' : ''}`}
    >
      <span className="absolute inset-y-0 right-0 w-1" style={{ background: t.hex }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-1 text-xl font-bold leading-tight text-navy-900 md:text-2xl">{value}</div>
          {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
        </div>
        {Icon && (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.bg} ${t.text}`}>
            <Icon size={20} />
          </span>
        )}
      </div>
    </button>
  );
}

export function Panel({ title, icon: Icon, actions, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`card fade-in min-w-0 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            {Icon && <Icon size={17} className="text-petrol-600" />}
            {title}
          </h3>
          {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Progress({ value, className = '' }) {
  if (!isNum(value)) return <div className="text-xs text-slate-400">لا توجد نسبة</div>;
  const over = value > 1;
  const w = Math.max(0, Math.min(100, value * 100));
  const color = over ? '#7c3aed' : value >= 1 ? '#10B981' : value >= 0.75 ? '#0F2537' : value >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold" style={{ color }}>{fmtPct(value)}</span>
        {over && <Badge tone="purple">تجاوز 100%</Badge>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="bar-anim h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}

export function Empty({ text = 'لا توجد بيانات' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
      <Inbox size={32} />
      <div className="text-sm">{text}</div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" />
      <aside
        className="fade-in relative mr-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 bg-navy-900 px-5 py-4 text-white">
          <h3 className="text-base font-bold leading-snug">{title}</h3>
          <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

/** جدول قابل للفرز */
export function DataTable({ columns, rows, onRow, maxH = 'max-h-[560px]', rowKey = (r, i) => i, rowClass }) {
  const [sort, setSort] = useState(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = columns.find((x) => x.key === sort.key);
    const val = (r) => (c.sortValue ? c.sortValue(r) : c.value ? c.value(r) : r[c.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar');
      return sort.dir * d;
    });
  }, [rows, sort, columns]);
  if (!rows.length) return <Empty />;
  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 ${maxH}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="th">
                <button className="inline-flex items-center gap-1" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key ? -s.dir : -1 }))}>
                  {c.label}
                  <ArrowUpDown size={11} className="opacity-60" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={rowKey(r, i)} onClick={onRow ? () => onRow(r) : undefined} className={`${onRow ? 'cursor-pointer hover:bg-cyan-50/60' : ''} ${i % 2 ? 'bg-slate-50/50' : ''} ${rowClass ? rowClass(r) : ''}`}>
              {columns.map((c) => (
                <td key={c.key} className={`td ${c.num ? 'whitespace-nowrap tabular-nums' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : cellText(c.value ? c.value(r) : r[c.key]) || <span className="text-slate-300">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'بحث فوري…' }) {
  return (
    <label className="relative block">
      <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className="input pr-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Select({ label, value, onChange, options, all = 'الكل' }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {all != null && <option value="">{all}</option>}
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </label>
  );
}

const tip = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'IBM Plex Sans Arabic', fontSize: 12, direction: 'rtl' } };

/** دائري: data=[{name,value,color?}] */
export function Donut({ data, onSelect, active, money, height = 240 }) {
  if (!data.length) return <Empty />;
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2} onClick={(d) => onSelect?.(d.name)} cursor={onSelect ? 'pointer' : 'default'} isAnimationActive>
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color || PALETTE[i % PALETTE.length]} opacity={active && active !== d.name ? 0.3 : 1} stroke="#fff" />
              ))}
            </Pie>
            <Tooltip {...tip} formatter={(v) => (money ? fmtM(v) + ' ر.س' : v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-lg font-bold text-navy-900">{money ? fmtM(total) : total}</div>
            <div className="text-[10px] text-slate-500">{money ? 'ر.س' : 'الإجمالي'}</div>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1 sm:w-1/2">
        {data.map((d, i) => (
          <li key={d.name}>
            <button onClick={() => onSelect?.(d.name)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-right text-xs hover:bg-slate-50 ${active === d.name ? 'bg-cyan-50 font-bold' : ''}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color || PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 truncate" title={d.name}>{d.name}</span>
              <span className="font-bold tabular-nums">{money ? fmtM(d.value) : d.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** أعمدة: data=[{name, ...keys}] bars=[{key,label,color}] */
export function Bars({ data, bars, onSelect, active, money, horizontal, height = 280, labels }) {
  if (!data.length) return <Empty />;
  const fmt = (v) => (money ? fmtM(v) : v);
  const h = horizontal ? Math.max(height, data.length * 34 + 40) : height;
  const tilt = data.length > 4;
  const cut = (v) => (typeof v === 'string' && v.length > 28 ? v.slice(0, 27) + '…' : v);
  return (
    <div style={{ height: h }} dir="ltr">
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 16, right: horizontal ? 64 : 8, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans Arabic' }} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans Arabic' }} interval={0} tickFormatter={cut} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" reversed tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans Arabic' }} interval={0} angle={tilt ? 30 : 0} textAnchor={tilt ? 'start' : 'middle'} height={tilt ? 90 : 30} tickFormatter={cut} />
              <YAxis orientation="right" tickFormatter={fmt} tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans Arabic' }} width={64} />
            </>
          )}
          <Tooltip {...tip} formatter={(v, n) => [money ? fmtM(v) + ' ر.س' : v, n]} cursor={{ fill: '#0F253714' }} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontFamily: 'IBM Plex Sans Arabic', fontSize: 12 }} />}
          {bars.map((b, bi) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color || PALETTE[bi]} radius={horizontal ? [0, 4, 4, 0] : [6, 6, 0, 0]} onClick={(d) => onSelect?.(d.payload?.name ?? d.name)} cursor={onSelect ? 'pointer' : 'default'}>
              {bars.length === 1 && data.map((d, i) => <Cell key={i} fill={active === d.name ? '#F37021' : d.color || b.color || PALETTE[bi]} opacity={active && active !== d.name ? 0.35 : 1} />)}
              {labels && <LabelList dataKey={b.key} position={horizontal ? 'right' : 'top'} formatter={fmt} style={{ fontSize: 10, fontFamily: 'IBM Plex Sans Arabic', fill: '#334155' }} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** عرض كل الخلايا الأصلية لصف (عنوان: قيمة) */
export function FieldList({ columns, row, highlight = [] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
      {columns.map((c) => {
        const v = row.cells?.[c.col];
        const merged = row.merged?.[c.col];
        return (
          <div key={c.col} className={`grid grid-cols-5 gap-2 px-3 py-2 text-sm ${highlight.includes(c.col) ? 'bg-cyan-50/50' : ''}`}>
            <dt className="col-span-2 text-xs font-semibold text-slate-500">
              {c.label}
              {c.group && <span className="block text-[10px] text-slate-400">{c.group}</span>}
            </dt>
            <dd className="col-span-3 break-words font-medium text-navy-900">
              {v == null || v === '' ? <span className="text-slate-300">فارغ</span> : typeof v === 'object' ? <Badge tone="red">{v.err}</Badge> : isNum(v) && Math.abs(v) >= 1000 && !/رقم/.test(c.label) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : cellText(v)}
              {merged && <span className="mr-2 text-[10px] text-slate-400">(خلية مدمجة {merged})</span>}
            </dd>
          </div>
        );
      })}
      {Object.entries(row.extras || {}).map(([col, v]) => (
        <div key={col} className="grid grid-cols-5 gap-2 bg-amber-50/40 px-3 py-2 text-sm">
          <dt className="col-span-2 text-xs font-semibold text-amber-700">عمود {col} (بدون عنوان)</dt>
          <dd className="col-span-3 font-medium">{cellText(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NoReport({ role }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <Inbox size={40} className="mx-auto mb-3 text-petrol-600" />
      <h2 className="mb-1 text-lg font-bold text-navy-900">لا يوجد تقرير معتمد بعد</h2>
      <p className="mb-4 text-sm text-slate-600">{role === 'admin' ? 'ابدأ باستيراد ملف Excel الأسبوعي لعرض المؤشرات والرسوم.' : 'سيظهر التقرير هنا بعد أن يعتمد المدير أول ملف.'}</p>
      {role === 'admin' && <a href="#import" className="btn-primary">استيراد ملف Excel</a>}
    </div>
  );
}
