import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";
import { currentUser, canEdit, json, cors } from "../lib/auth.mts";

// استخراج صفوف «جدول الأعمال اليومية» (منصة التخطيط اليومي) من صورة أو PDF أو نص.
// لا يكتب شيئاً: يعيد الصفوف بترتيب أعمدة «لصق من Excel» في المنصة لتُراجع وتُستورد هناك.
const COLS: [string, string][] = [
  ["woNumber", "أمر العمل (رقم)"], ["workType", "نوع العمل / وصف العمل"], ["category", "التصنيف: مشاريع أو إنشاءات"],
  ["contractor", "المقاول"], ["receiver", "المستلم"], ["mobile", "الجوال"], ["location", "الموقع"],
  ["mapsUrl", "رابط الموقع (Google Map)"], ["coordsText", "الإحداثيات"], ["voltage", "الجهد"],
  ["consultant", "الاستشاري"], ["notificationNo", "رقم الإشعار"],
];
const TOOL = {
  name: "daily_jobs",
  description: "صفوف جدول الأعمال اليومية، صف لكل أمر عمل.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: ["string", "null"], description: "تاريخ الجدول إن ظهر في المستند بصيغة YYYY-MM-DD" },
      rows: { type: "array", items: { type: "object", properties: Object.fromEntries(COLS.map(([k, l]) => [k, { type: ["string", "null"], description: l }])) } },
      notes: { type: "string", description: "ملاحظات قصيرة عما لم يُقرأ بوضوح" },
    },
    required: ["rows"],
  },
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const u = await currentUser(req);
  if (!u) return json(req, { error: "سجّل الدخول لمنصة الوبران أولاً" }, 401);
  if (!canEdit(u, "dispatch")) return json(req, { error: "الاستيراد يحتاج صلاحية «تعديل» على منصة التخطيط اليومي" }, 403);
  let b: any; try { b = await req.json(); } catch { return json(req, { error: "طلب غير صالح" }, 400); }
  const content: any[] = [];
  if (b.kind === "pdf" && b.data) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b.data } });
  else if (b.kind === "image" && b.data && /^image\/(png|jpeg|webp|gif)$/.test(b.media_type || "")) content.push({ type: "image", source: { type: "base64", media_type: b.media_type, data: b.data } });
  else if (b.kind === "text" && b.text) content.push({ type: "text", text: "النص:\n" + String(b.text).slice(0, 60000) });
  else return json(req, { error: "أرفق صورة أو PDF أو الصق نصاً" }, 400);
  content.push({ type: "text", text: `استخرج كل صفوف جدول الأعمال اليومية (أوامر العمل) إلى أداة daily_jobs.
- انقل القيم كما هي حرفياً، ولا تخترع شيئاً: اترك الحقل null إن لم يظهر.
- أرقام أمر العمل والجوال والإشعار نص كما هي بدون مسافات، مع الأصفار البادئة.
- إن كان الموقع مكتوباً في أول صف من مجموعة فقط فكرره لصفوف المجموعة.
- التصنيف «مشاريع» أو «إنشاءات» فقط إن ظهر صراحة.
- الإحداثيات بالصيغة المكتوبة نفسها، والرابط كاملاً.` });
  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY) return json(req, { error: "المساعد الذكي غير متاح حالياً" }, 503);
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: Netlify.env.get("HUB_AI_MODEL") || "claude-sonnet-5-5",
      max_tokens: 16000, tools: [TOOL], tool_choice: { type: "tool", name: "daily_jobs" },
      messages: [{ role: "user", content }],
    });
    const t: any = res.content.find((x: any) => x.type === "tool_use");
    return json(req, { cols: COLS.map((c) => c[0]), date: t?.input?.date || null, rows: Array.isArray(t?.input?.rows) ? t.input.rows : [], notes: t?.input?.notes || "", truncated: res.stop_reason === "max_tokens" });
  } catch (e) {
    return json(req, { error: "تعذّر الاستخراج: " + String((e as Error).message || e).slice(0, 200) }, 502);
  }
};

export const config: Config = { path: "/api/edc-extract", method: ["POST", "OPTIONS"] };
