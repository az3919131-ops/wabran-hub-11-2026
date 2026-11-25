import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Wallet, GitCompareArrows, UploadCloud, Maximize2, Minimize2, Printer, LogOut, Menu, X, CalendarDays, Loader2, ShieldCheck, Eye, AlertTriangle } from 'lucide-react';
import { api, getPin, setPin } from './lib/api.js';
import { fmtDate } from './lib/analytics.js';
import Projects from './pages/Projects.jsx';
import Collections from './pages/Collections.jsx';
import Compare from './pages/Compare.jsx';
import Import from './pages/Import.jsx';

const PAGES = [
  { id: 'projects', label: 'المشاريع الأكبر من 100 ألف', icon: Building2 },
  { id: 'collections', label: 'خطة التحصيل', icon: Wallet },
  { id: 'compare', label: 'المقارنة والأرشيف الأسبوعي', icon: GitCompareArrows },
  { id: 'import', label: 'استيراد وتحديث البيانات', icon: UploadCloud },
];
const pageFromHash = () => (PAGES.some((p) => `#${p.id}` === location.hash) ? location.hash.slice(1) : 'projects');

export const Footer = () => (
  <footer className="mt-8 border-t border-slate-200 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
    Project Manager | Eng. Ahmed Zahran
  </footer>
);

// وضع التطوير المحلي (vite dev) بدون دوال Netlify: البيانات في الذاكرة فقط
const LOCAL = import.meta.env.DEV && !import.meta.env.VITE_USE_API;

export default function App() {
  const local = LOCAL;
  const [role, setRole] = useState(local || getPin() ? 'admin' : 'viewer');
  const [list, setList] = useState([]); // بيانات وصفية لكل التقارير (الأحدث أولاً)
  const [cache, setCache] = useState({}); // id -> تقرير كامل
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(!local);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(pageFromHash());
  const [menu, setMenu] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    const f = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => { window.removeEventListener('hashchange', on); document.removeEventListener('fullscreenchange', f); };
  }, []);

  const loadFull = useCallback(async (id) => {
    if (!id || cache[id] || local) return cache[id];
    const data = await api.get(id);
    setCache((c) => ({ ...c, [id]: data }));
    return data;
  }, [cache, local]);

  const refresh = useCallback(async (selectId) => {
    if (local) return;
    setLoading(true); setError(null);
    try {
      const data = await api.list();
      setList(data);
      const id = selectId || data[0]?.id || null;
      setCurrentId(id);
      if (id) await loadFull(id);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [local, loadFull]);

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectReport = async (id) => {
    setCurrentId(id);
    try { await loadFull(id); } catch (e) { setError(e.message); }
  };

  // يُستدعى من صفحة الاستيراد بعد الحفظ
  const onImported = async (saved) => {
    setCache((c) => ({ ...c, [saved.id]: saved }));
    if (local) {
      setList((l) => [saved, ...l].sort((a, b) => (b.report_date + b.uploaded_at).localeCompare(a.report_date + a.uploaded_at)));
      setCurrentId(saved.id);
    } else await refresh(saved.id);
    location.hash = '#projects';
  };
  const onDeleted = async (id) => {
    if (local) {
      setList((l) => l.filter((r) => r.id !== id));
      if (currentId === id) setCurrentId(list.find((r) => r.id !== id)?.id || null);
      return;
    }
    await refresh(currentId === id ? undefined : currentId);
  };

  // دخول المدير برمز ADMIN_PIN المضبوط في Netlify
  const login = async (pin) => {
    await api.checkPin(pin);
    setPin(pin);
    setRole('admin');
  };
  const logout = () => { setPin(''); setRole('viewer'); };

  const current = currentId ? cache[currentId] : null;
  const idx = list.findIndex((r) => r.id === currentId);
  const prevMeta = idx >= 0 ? list[idx + 1] : null;
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!prevMeta) { setPrev(null); return; }
    Promise.resolve(cache[prevMeta.id] || loadFull(prevMeta.id)).then((r) => alive && setPrev(r || null)).catch(() => {});
    return () => { alive = false; };
  }, [prevMeta?.id, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ list, current, prev, role, local, loadFull, cache, onImported, onDeleted, login }), [list, current, prev, role, local, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id) => { location.hash = `#${id}`; setMenu(false); };
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  const PageComp = { projects: Projects, collections: Collections, compare: Compare, import: Import }[page];
  const pageMeta = PAGES.find((p) => p.id === page);

  return (
    <div className="min-h-screen overflow-x-clip lg:pr-64">
      {/* القائمة الجانبية */}
      <aside className={`no-print fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-[rgba(200,155,110,.3)] bg-navy-900 text-white transition-transform lg:translate-x-0 ${menu ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <img src="https://wabran-najran-hub.netlify.app/img/wabran-logo.png" alt="الوبران" className="h-11 w-11 shrink-0 rounded-[10px] bg-white object-contain p-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight">الوبران · نجران</div>
            <div className="text-[11px] font-semibold text-sand">مشاريع قطاع الطاقة</div>
          </div>
          <button className="mr-auto rounded-lg p-1 hover:bg-white/10 lg:hidden" onClick={() => setMenu(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {PAGES.map((p) => (
            <button key={p.id} onClick={() => go(p.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-semibold transition ${page === p.id ? 'border-s-[3px] border-petrol-600 bg-[rgba(243,112,33,.14)] text-white' : 'border-s-[3px] border-transparent text-slate-300 hover:bg-white/5 hover:text-white'}`}>
              <p.icon size={18} className={page === p.id ? 'text-petrol-500' : ''} />
              {p.label}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-3 text-sm">
          <button onClick={toggleFs} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10">{fs ? <Minimize2 size={17} /> : <Maximize2 size={17} />}{fs ? 'إنهاء ملء الشاشة' : 'عرض بملء الشاشة'}</button>
          <button onClick={() => window.print()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10"><Printer size={17} />طباعة / حفظ PDF</button>
          {!local && role === 'admin' && <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10"><LogOut size={17} />خروج المدير</button>}
          <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-slate-300">
            {role === 'admin' ? <ShieldCheck size={14} className="text-petrol-500" /> : <Eye size={14} />}
            <span className="truncate" dir="ltr">{local ? 'معاينة محلية' : role === 'admin' ? 'وضع المدير' : 'وضع العرض'}</span>
            <span className="mr-auto rounded bg-white/10 px-1.5">{role === 'admin' ? 'Admin' : 'Viewer'}</span>
          </div>
        </div>
      </aside>
      {menu && <div className="no-print fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setMenu(false)} />}

      {/* الشريط العلوي */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur print:static">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <button className="no-print rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMenu(true)}><Menu size={20} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-navy-900 md:text-lg">{pageMeta.label}</h1>
            <p className="truncate text-[11px] font-semibold text-slate-500">منصة متابعة مشاريع الوبران – فرع نجران · NAJRAN PROJECTS DASHBOARD</p>
          </div>
          {list.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <CalendarDays size={16} className="text-petrol-600" />
              <span className="hidden sm:inline">تقرير أسبوع:</span>
              <select className="input w-auto py-1.5" value={currentId || ''} onChange={(e) => selectReport(e.target.value)}>
                {list.map((r, i) => (
                  <option key={r.id} value={r.id}>{fmtDate(r.report_date)}{i === 0 ? ' (الأحدث)' : ''}</option>
                ))}
              </select>
            </label>
          )}
          {loading && <Loader2 className="animate-spin text-petrol-600" size={18} />}
        </div>
        {local && (
          <div className="no-print flex items-center gap-2 bg-amber-50 px-4 py-1.5 text-[11px] font-semibold text-amber-800 md:px-6">
            <AlertTriangle size={14} />وضع التطوير المحلي: البيانات المستوردة تُعرض فقط ولا تُحفظ (الحفظ يعمل على Netlify).
          </div>
        )}
      </header>

      <main className="print-full mx-auto max-w-[1600px] p-4 md:p-6">
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">تعذر تحميل البيانات: {error}</div>}
        {loading && !current && page !== 'import' ? <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-petrol-600" size={32} /></div> : <PageComp ctx={ctx} />}
        <Footer />
      </main>
    </div>
  );
}
