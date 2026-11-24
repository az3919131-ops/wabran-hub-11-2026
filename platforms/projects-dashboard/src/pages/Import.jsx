import { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Info, Loader2, ShieldAlert, Save, KeyRound } from 'lucide-react';
import { parseWorkbook, sha256 } from '../lib/parse.js';
import { projectRows, projectKpis, collectionModel, validateReport, totalsCheck, fmtM, fmtNum, fmtPct, fmtDate } from '../lib/analytics.js';
import { api } from '../lib/api.js';
import { Panel, Badge, Kpi, DataTable } from '../components/ui.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const LV = { error: { icon: XCircle, cls: 'bg-red-50 text-red-700' }, warn: { icon: AlertTriangle, cls: 'bg-orange-50 text-orange-800' }, info: { icon: Info, cls: 'bg-slate-50 text-slate-600' } };

export default function Import({ ctx }) {
  const { role, local, list, onImported, login } = ctx;
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(today());
  const [res, setRes] = useState(null); // {report, hash, errors, warnings}
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [drag, setDrag] = useState(false);
  const input = useRef();

  if (role !== 'admin') return <PinGate login={login} />;

  const handle = async (f) => {
    if (!f) return;
    setMsg(null); setRes(null); setFile(f);
    if (!/\.xlsx?$|\.xlsm$/i.test(f.name)) return setMsg({ tone: 'bad', text: 'الملف يجب أن يكون Excel (xlsx / xls).' });
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const [hash, parsed] = await Promise.all([sha256(buf), parseWorkbook(new Uint8Array(buf), f.name)]);
      const checks = parsed.report.projects_data ? validateReport(parsed.report) : [];
      const errors = [...parsed.errors.map((t) => ({ level: 'error', text: t })), ...checks.filter((c) => c.level === 'error')];
      setRes({ ...parsed, hash, checks: [...errors, ...parsed.warnings.map((t) => ({ level: 'warn', text: t })), ...checks.filter((c) => c.level !== 'error')], blocked: errors.length > 0, dup: list.find((r) => r.file_hash === hash) });
      // اقتراح تاريخ التقرير من اسم الملف (مثل 11-11-2026)
      const m = f.name.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/);
      if (m) setDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    } catch (e) {
      setMsg({ tone: 'bad', text: 'تعذرت قراءة الملف: ' + (e.message || e) });
    } finally { setBusy(false); }
  };

  const approve = async () => {
    if (!res || res.blocked) return;
    if (res.dup && !confirm(`هذا الملف نفسه مستورد مسبقاً بتاريخ ${fmtDate(res.dup.report_date)}. هل تريد استيراده مرة أخرى؟`)) return;
    const sameDate = list.find((r) => r.report_date === date);
    if (sameDate && !res.dup && !confirm(`يوجد تقرير بنفس التاريخ (${fmtDate(date)}). سيُحفظ التقرير الجديد كنسخة إضافية ويصبح المعروض. متابعة؟`)) return;
    setSaving(true); setMsg(null);
    const row = { report_date: date, file_name: file.name, file_hash: res.hash, ...res.report };
    try {
      let saved;
      if (local) saved = { ...row, id: crypto.randomUUID(), uploaded_at: new Date().toISOString() };
      else {
        saved = await api.save(row);
      }
      setMsg({ tone: 'good', text: 'تم اعتماد التقرير وتحديث جميع المؤشرات.' });
      setRes(null); setFile(null);
      await onImported(saved);
    } catch (e) {
      // فشل الحفظ: يبقى التقرير السابق كما هو
      setMsg({ tone: 'bad', text: 'فشل الحفظ، ولم يتغير التقرير السابق: ' + (e.message || e) });
    } finally { setSaving(false); }
  };

  const r = res?.report;
  const plist = r?.projects_data ? projectRows(r.projects_data) : [];
  const k = projectKpis(plist);
  const cm = collectionModel(r?.collections_data);

  return (
    <div className="space-y-5">
      <Panel title="رفع ملف Excel الأسبوعي" icon={UploadCloud}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
            onClick={() => input.current.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition lg:col-span-2 ${drag ? 'border-petrol-500 bg-cyan-50' : 'border-slate-300 hover:border-petrol-500 hover:bg-slate-50'}`}
          >
            {busy ? <Loader2 size={40} className="animate-spin text-petrol-600" /> : <FileSpreadsheet size={40} className="text-petrol-600" />}
            <div className="font-bold text-navy-900">{file ? file.name : 'اسحب ملف Excel وأفلته هنا'}</div>
            <div className="text-xs text-slate-500">أو اضغط لاختيار الملف · يجب أن يحتوي شيت "مشاريع اكبر من 100" وشيت "خطة تحصيل محتملة"</div>
            <span className="btn-primary mt-2">اختيار ملف Excel</span>
            <input ref={input} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={(e) => { handle(e.target.files[0]); e.target.value = ''; }} />
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">تاريخ التقرير (الأسبوع)
              <input type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
              <b className="text-navy-900">خطوات الاعتماد:</b> قراءة الشيتات ← التحقق ← الحفظ في قاعدة البيانات ← الاحتفاظ بالتقارير السابقة ← تحديث كل الصفحات لجميع المستخدمين.
            </div>
            <div className="text-xs text-slate-500">التقارير المحفوظة: <b>{list.length}</b>{list[0] && <> · آخر تقرير {fmtDate(list[0].report_date)}</>}</div>
          </div>
        </div>
        {msg && <div className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-sm ${msg.tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.tone === 'bad' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}{msg.text}</div>}
      </Panel>

      {res && (
        <>
          {res.dup && <div className="flex items-center gap-2 rounded-xl bg-orange-50 p-3 text-sm font-semibold text-orange-800"><AlertTriangle size={18} />هذا الملف مطابق تماماً لتقرير مستورد سابقاً ({fmtDate(res.dup.report_date)} — {res.dup.file_name}).</div>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={FileSpreadsheet} label="المشاريع المستوردة" value={fmtNum(k.count)} sub={r.projects_data?.sheet} />
            <Kpi icon={FileSpreadsheet} tone="blue" label="سجلات خطة التحصيل" value={fmtNum(cm.blocks.reduce((a, b) => a + b.rows.length, 0))} sub={cm.blocks.map((b) => `${b.rows.length}`).join(' + ') + ' (حسب الجداول)'} />
            <Kpi icon={FileSpreadsheet} tone="green" label="التقديرية / المنفذة" value={fmtPct(k.ratio)} sub={`${fmtM(k.exec)} من ${fmtM(k.est)}`} />
            <Kpi icon={FileSpreadsheet} tone="slate" label="الشيتات الداعمة" value={fmtNum(r.supporting_data.sheets.length)} sub={r.supporting_data.sheets.map((s) => s.name.trim()).join('، ')} />
          </div>
          <Panel title={`نتائج التحقق (${res.checks.length})`} icon={CheckCircle2}>
            <ul className="space-y-2">
              {totalsCheck(r.projects_data).map((t) => (
                <li key={t.field} className={`flex items-center gap-2 rounded-xl p-2.5 text-xs ${t.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {t.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}إجمالي "{t.label}": محسوب {fmtNum(t.calc)} — Excel {fmtNum(t.excel)} {t.ok ? '(مطابق)' : '(غير مطابق)'}
                </li>
              ))}
              {res.checks.map((c, i) => { const L = LV[c.level]; return <li key={i} className={`flex items-start gap-2 rounded-xl p-2.5 text-xs ${L.cls}`}><L.icon size={15} className="mt-0.5 shrink-0" />{c.text}</li>; })}
            </ul>
          </Panel>
          <Panel title="معاينة المشاريع" icon={FileSpreadsheet} actions={
            <button className="btn-primary" onClick={approve} disabled={res.blocked || saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}اعتماد التحديث</button>
          }>
            <DataTable maxH="max-h-96" rows={plist} rowKey={(p) => p._row} columns={[
              { key: '_row', label: 'صف', num: true }, { key: 'wo', label: 'رقم أمر العمل', num: true }, { key: 'name', label: 'اسم المشروع' }, { key: 'status', label: 'موقف التنفيذ' },
              { key: 'est', label: 'التقديرية', num: true, render: (p) => fmtNum(p.est) }, { key: 'exec', label: 'المنفذ', num: true, render: (p) => fmtNum(p.exec) }, { key: 'ratio', label: 'النسبة', render: (p) => fmtPct(p.ratio) },
            ]} />
            {res.blocked && <div className="mt-3 text-xs font-semibold text-red-700">لا يمكن الاعتماد بسبب أخطاء أساسية — التقرير السابق يبقى دون تغيير.</div>}
          </Panel>
          <Panel title="معاينة خطة التحصيل" icon={FileSpreadsheet}>
            {cm.blocks.map((b) => (
              <div key={b.index} className="mb-3">
                <div className="mb-2 text-sm font-bold text-navy-900">{b.title} <Badge tone="slate">{b.rows.length} سجل</Badge></div>
                <div className="flex flex-wrap gap-2">{b.stages.map((s) => <Badge key={s.col} tone="blue">{s.label.replace(/\s+/g, ' ')}: {fmtNum(s.total)} ({s.count})</Badge>)}</div>
              </div>
            ))}
          </Panel>
        </>
      )}

    </div>
  );
}

function PinGate({ login }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(pin); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm p-6 text-center">
      <ShieldAlert size={36} className="mx-auto mb-2 text-petrol-600" />
      <h2 className="font-bold text-navy-900">الاستيراد والتحديث للمدير فقط</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">أدخل رمز المدير للمتابعة. العرض والفلترة متاحان للجميع.</p>
      <label className="relative block">
        <KeyRound size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="password" className="input pr-9 text-center" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="رمز المدير" required dir="ltr" />
      </label>
      {err && <div className="mt-3 rounded-xl bg-red-50 p-2 text-xs text-red-700">{err}</div>}
      <button className="btn-primary mt-4 w-full justify-center" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}دخول المدير</button>
    </form>
  );
}
