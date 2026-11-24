import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Wallet, GitCompareArrows, UploadCloud, Maximize2, Minimize2, Printer, LogOut, Menu, X, CalendarDays, Loader2, ShieldCheck, Eye, AlertTriangle } from 'lucide-react';
import { supabase } from './lib/supabase.js';
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
const META = 'id, report_date, uploaded_at, file_name, file_hash, uploaded_by';
const pageFromHash = () => (PAGES.some((p) => `#${p.id}` === location.hash) ? location.hash.slice(1) : 'projects');

export const Footer = () => (
  <footer className="mt-8 border-t border-slate-200 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
    Project manager&nbsp; Eng&nbsp; Ahmed Zahran
  </footer>
);

function Login() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password: pass })
      : await supabase.auth.signUp({ email, password: pass });
    setBusy(false);
    if (error) setMsg({ tone: 'bad', text: error.message === 'Invalid login credentials' ? 'بيانات الدخول غير صحيحة' : error.message });
    else if (mode === 'up') setMsg({ tone: 'good', text: 'تم إنشاء الحساب. إن طُلب تأكيد البريد فأكده ثم سجّل الدخول. يحتاج الحساب لتفعيل من المدير.' });
  };
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-navy-950 via-navy-900 to-petrol-700 p-4">
      <form onSubmit={submit} className="card fade-in w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-navy-900 text-petrol-500"><Building2 size={28} /></div>
          <h1 className="text-lg font-extrabold text-navy-900">منصة متابعة مشاريع الوبران – فرع نجران</h1>
          <p className="text-xs font-bold tracking-widest text-petrol-600">NAJRAN PROJECTS DASHBOARD</p>
        </div>
        <label className="mb-3 block text-xs font-semibold text-slate-600">البريد الإلكتروني
          <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        <label className="mb-4 block text-xs font-semibold text-slate-600">كلمة المرور
          <input className="input mt-1" type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} dir="ltr" />
        </label>
        {msg && <div className={`mb-3 rounded-xl p-2.5 text-xs ${msg.tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>}
        <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{mode === 'in' ? 'تسجيل الدخول' : 'إنشاء حساب'}</button>
        <button type="button" className="mt-3 w-full text-xs font-semibold text-petrol-600" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
        </button>
        <Footer />
      </form>
    </div>
  );
}

export default function App() {
  const local = !supabase;
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(local);
  const [role, setRole] = useState(local ? 'admin' : null);
  const [list, setList] = useState([]); // بيانات وصفية لكل التقارير (الأحدث أولاً)
  const [cache, setCache] = useState({}); // id -> تقرير كامل
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (local) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [local]);

  const loadFull = useCallback(async (id) => {
    if (!id || cache[id] || local) return cache[id];
    const { data, error } = await supabase.from('weekly_reports').select('*').eq('id', id).single();
    if (error) throw error;
    setCache((c) => ({ ...c, [id]: data }));
    return data;
  }, [cache, local]);

  const refresh = useCallback(async (selectId) => {
    if (local) return;
    setLoading(true); setError(null);
    try {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      setRole(prof?.role || 'pending');
      if (!prof || prof.role === 'pending') return;
      const { data, error } = await supabase.from('weekly_reports').select(META).order('report_date', { ascending: false }).order('uploaded_at', { ascending: false });
      if (error) throw error;
      setList(data);
      const id = selectId || data[0]?.id || null;
      setCurrentId(id);
      if (id) await loadFull(id);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [local, session, loadFull]);

  useEffect(() => { if (session) refresh(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectReport = async (id) => {
    setCurrentId(id);
    try { await loadFull(id); } catch (e) { setError(e.message); }
  };

  // يُستدعى من صفحة الاستيراد بعد الحفظ
  const onImported = async (saved) => {
    if (local) {
      setList((l) => [saved, ...l].sort((a, b) => (b.report_date + b.uploaded_at).localeCompare(a.report_date + a.uploaded_at)));
      setCache((c) => ({ ...c, [saved.id]: saved }));
      setCurrentId(saved.id);
    } else {
      setCache((c) => ({ ...c, [saved.id]: saved }));
      await refresh(saved.id);
    }
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

  const ctx = useMemo(() => ({ list, current, prev, role, local, loadFull, cache, onImported, onDeleted, session }), [list, current, prev, role, local, cache, session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authReady) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-petrol-600" size={32} /></div>;
  if (!local && !session) return <Login />;
  if (!local && role === 'pending')
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="card max-w-md p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 text-orange-500" size={36} />
          <h2 className="mb-2 font-bold text-navy-900">الحساب بانتظار التفعيل</h2>
          <p className="text-sm text-slate-600">تم تسجيل الدخول بـ <b dir="ltr">{session.user.email}</b>. يرجى التواصل مع مدير المنصة لمنحك صلاحية العرض.</p>
          <button className="btn-ghost mx-auto mt-4" onClick={() => supabase.auth.signOut()}><LogOut size={16} />تسجيل الخروج</button>
          <Footer />
        </div>
      </div>
    );

  const go = (id) => { location.hash = `#${id}`; setMenu(false); };
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  const PageComp = { projects: Projects, collections: Collections, compare: Compare, import: Import }[page];
  const pageMeta = PAGES.find((p) => p.id === page);

  return (
    <div className="min-h-screen overflow-x-clip lg:pr-64">
      {/* القائمة الجانبية */}
      <aside className={`no-print fixed inset-y-0 right-0 z-40 flex w-64 flex-col bg-navy-900 text-white transition-transform lg:translate-x-0 ${menu ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-petrol-600"><Building2 size={22} /></span>
          <div className="min-w-0">
            <div className="text-sm font-extrabold leading-tight">مشاريع الوبران – نجران</div>
            <div className="text-[10px] font-bold tracking-widest text-cyan-300">NAJRAN PROJECTS</div>
          </div>
          <button className="mr-auto rounded-lg p-1 hover:bg-white/10 lg:hidden" onClick={() => setMenu(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {PAGES.map((p) => (
            <button key={p.id} onClick={() => go(p.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-semibold transition ${page === p.id ? 'bg-white text-navy-900 shadow' : 'text-slate-200 hover:bg-white/10'}`}>
              <p.icon size={18} className={page === p.id ? 'text-petrol-600' : ''} />
              {p.label}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-3 text-sm">
          <button onClick={toggleFs} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10">{fs ? <Minimize2 size={17} /> : <Maximize2 size={17} />}{fs ? 'إنهاء ملء الشاشة' : 'عرض بملء الشاشة'}</button>
          <button onClick={() => window.print()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10"><Printer size={17} />طباعة / حفظ PDF</button>
          {!local && <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10"><LogOut size={17} />تسجيل الخروج</button>}
          <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-slate-300">
            {role === 'admin' ? <ShieldCheck size={14} className="text-cyan-300" /> : <Eye size={14} />}
            <span className="truncate" dir="ltr">{local ? 'معاينة محلية' : session?.user.email}</span>
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
            <h1 className="truncate text-base font-extrabold text-navy-900 md:text-lg">{pageMeta.label}</h1>
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
            <AlertTriangle size={14} />وضع المعاينة المحلية: لم تُضبط متغيرات Supabase، فالبيانات المستوردة تُعرض فقط ولا تُحفظ. راجع README للإعداد.
          </div>
        )}
      </header>

      <main className="print-full mx-auto max-w-[1600px] p-4 md:p-6">
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">تعذر تحميل البيانات: {error}</div>}
        <PageComp ctx={ctx} />
        <Footer />
      </main>
    </div>
  );
}
