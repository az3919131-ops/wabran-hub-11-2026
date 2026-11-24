// قاعدة البيانات الداخلية: Netlify Blobs
// GET  /api/reports           -> قائمة التقارير (بيانات وصفية)
// GET  /api/reports?id=..     -> تقرير كامل
// POST /api/reports           -> حفظ تقرير جديد (يتطلب رمز المدير)
// POST /api/reports?check=1   -> التحقق من رمز المدير
// DELETE /api/reports?id=..   -> حذف تقرير (يتطلب رمز المدير)
import { getStore } from '@netlify/blobs';

const MAX = 8_000_000;
const json = (b, s = 200) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store' } });

export default async (req) => {
  const url = new URL(req.url);
  const store = getStore({ name: 'najran-projects', consistency: 'strong' });
  const index = (await store.get('index', { type: 'json' })) || [];

  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) return json(index);
    const r = await store.get(`r/${id}`, { type: 'json' });
    return r ? json(r) : json({ error: 'التقرير غير موجود' }, 404);
  }

  const pin = Netlify.env.get('ADMIN_PIN');
  if (!pin) return json({ error: 'لم يُضبط رمز المدير ADMIN_PIN في إعدادات Netlify.' }, 503);
  if (req.headers.get('x-admin-pin') !== pin) return json({ error: 'رمز المدير غير صحيح.' }, 401);

  if (req.method === 'POST') {
    if (url.searchParams.get('check')) return json({ ok: true });
    const text = await req.text();
    if (text.length > MAX) return json({ error: 'الملف أكبر من الحد المسموح' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'صيغة غير صحيحة' }, 400); }
    if (!body?.projects_data || !/^\d{4}-\d{2}-\d{2}$/.test(body.report_date || '')) return json({ error: 'بيانات التقرير ناقصة' }, 400);
    const report = {
      id: crypto.randomUUID(),
      report_date: body.report_date,
      uploaded_at: new Date().toISOString(),
      file_name: String(body.file_name || '').slice(0, 200),
      file_hash: String(body.file_hash || '').slice(0, 64),
      projects_data: body.projects_data,
      collections_data: body.collections_data ?? null,
      supporting_data: body.supporting_data ?? null,
      uploaded_by: 'admin',
    };
    // يُحفظ التقرير أولاً، ثم يُحدَّث الفهرس؛ إن فشل الحفظ يبقى التقرير السابق كما هو
    await store.setJSON(`r/${report.id}`, report);
    const { projects_data, collections_data, supporting_data, ...meta } = report;
    const next = [meta, ...index].sort((a, b) => (b.report_date + b.uploaded_at).localeCompare(a.report_date + a.uploaded_at));
    await store.setJSON('index', next);
    return json(report, 201);
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!index.some((r) => r.id === id)) return json({ error: 'التقرير غير موجود' }, 404);
    await store.setJSON('index', index.filter((r) => r.id !== id));
    await store.delete(`r/${id}`);
    return json({ ok: true });
  }
  return new Response('Method not allowed', { status: 405 });
};

export const config = { path: '/api/reports' };
