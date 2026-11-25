import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";
import { currentUser, canEdit } from "../lib/auth.mts";

// استخراج أوامر العمل من PDF أو صورة أو نص ملصوق إلى حقول منصة إسناد أوامر العمل.
// لا يكتب في أي قاعدة بيانات: يعيد الصفوف للمراجعة، ثم يُنزَّل ملف Excel يُستورد من مركز الاستيراد في المنصة.
const FIELDS: [string, string, string][] = [
  ["wo_number", "رقم أمر العمل", "id"], ["contract_number", "رقم العقد", "id"], ["work_type_code", "رمز نوع أمر العمل", "id"],
  ["work_type_name", "نوع امر العمل", "text"], ["wo_status", "موقف أمر العمل", "text"], ["payment_status", "حالة الصرف", "text"],
  ["contractor_number", "رقم المقاول", "id"], ["contractor_name", "المقاول", "text"], ["office_code", "رمز المكتب", "id"], ["office_name", "المكتب", "text"],
  ["approved_value", "قيمة أمر العمل المعتمدة", "money"], ["estimated_budget", "الميزانية التقديرية", "money"], ["labor_cost", "تكلفة العمالة", "money"],
  ["issued_material_cost", "تكلفة المواد المصروفه", "money"], ["unissued_material_cost", "تكلفة المواد الغير مصروفه", "money"], ["total_actual_cost", "التكلفة الفعلية الإجمالية", "money"],
  ["certificate_amount", "مبلغ شهادة الإنجاز", "money"], ["actual_paid_amount", "المبلغ المصروف فعلياً", "money"],
  ["delivered_date", "تاريخ التسليم للمقاول", "date"], ["received_date", "تاريخ الاستلام من المقاول", "date"], ["cert_date", "تاريخ شهادة الانجاز", "date"],
  ["cert_approval_date", "تاريخ اعتماد شهادة الانجاز", "date"], ["contractor_cert_approval_date", "تاريخ اعتماد المقاول لشهادة الانجاز", "date"],
  ["extract_number", "رقم المستخلص", "id"], ["extract_date", "تاريخ المستخلص", "date"], ["planned_completion_date", "تاريخ الإنجاز المخطط", "date"],
  ["actual_completion_date", "تاريخ الإنجاز الفعلي", "date"], ["expected_payment_date", "تاريخ الصرف المتوقع", "date"], ["actual_payment_date", "تاريخ الصرف الفعلي", "date"],
  ["management_notes", "ملاحظات الإدارة", "text"], ["risk_level", "مستوى المخاطر", "text"], ["follow_up_owner", "المسؤول عن المتابعة", "text"],
];
const WO_STATUS = ["تم تسليم المقاول ولم يتم الاستلام", "تم الاستلام من المقاول ولم تصدر شهادة الانجاز", "صدرت شهادة الانجاز ولم تعتمد", "معتمد ولم تأكد من المقاول", "مؤكد ولم تدخل مستخلص", "دخلت مستخلص ولم تصرف", "منتهي"];
const PAY_STATUS = ["تم الصرف", "لم تصرف"];

const TOOL = {
  name: "work_orders",
  description: "أوامر العمل المستخرجة من المستند، صف لكل أمر عمل (أمر × رمز نوع).",
  input_schema: {
    type: "object" as const,
    properties: {
      rows: {
        type: "array",
        items: { type: "object", properties: Object.fromEntries(FIELDS.map(([k, l, t]) => [k, { type: t === "money" ? ["number", "null"] : ["string", "null"], description: l + (t === "date" ? " بصيغة YYYY-MM-DD" : "") }])) },
      },
      notes: { type: "string", description: "ملاحظات قصيرة عما لم يُقرأ بوضوح أو الحقول الناقصة" },
    },
    required: ["rows"],
  },
};

export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const u = await currentUser(req);
  if (!u) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (!canEdit(u, "assign")) return Response.json({ error: "إضافة أوامر العمل تحتاج صلاحية «تعديل» على منصة إسناد أوامر العمل" }, { status: 403 });
  let b: any; try { b = await req.json(); } catch { return Response.json({ error: "طلب غير صالح" }, { status: 400 }); }
  const content: any[] = [];
  if (b.kind === "pdf" && b.data) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b.data } });
  else if (b.kind === "image" && b.data && /^image\/(png|jpeg|webp|gif)$/.test(b.media_type || "")) content.push({ type: "image", source: { type: "base64", media_type: b.media_type, data: b.data } });
  else if (b.kind === "text" && b.text) content.push({ type: "text", text: "النص الملصوق:\n" + String(b.text).slice(0, 60000) });
  else return Response.json({ error: "أرفق ملف PDF أو صورة أو الصق نصاً" }, { status: 400 });
  content.push({ type: "text", text: `استخرج كل أوامر العمل في هذا المستند إلى أداة work_orders.
- لا تخترع قيماً: اترك الحقل null إن لم يظهر في المستند.
- الأرقام (أمر العمل، العقد، رمز النوع، المقاول، المستخلص) تُنقل كنص كما هي بدون فواصل ومع الأصفار البادئة.
- المبالغ أرقام بدون فواصل أو عملة. التواريخ YYYY-MM-DD (حوّل الهجري للميلادي فقط إن كان التحويل مؤكداً، وإلا اتركه null واذكره في الملاحظات).
- موقف أمر العمل واحد من: ${WO_STATUS.join(" | ")}.
- حالة الصرف واحدة من: ${PAY_STATUS.join(" | ")}.
- إن كان أمر العمل يحتوي أكثر من رمز نوع فاجعل لكل رمز صفاً.` });
  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ai_unavailable" }, { status: 503 });
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: Netlify.env.get("HUB_AI_MODEL") || "claude-sonnet-5-5",
      max_tokens: 16000,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "work_orders" },
      messages: [{ role: "user", content }],
    });
    const t: any = res.content.find((x: any) => x.type === "tool_use");
    const rows = Array.isArray(t?.input?.rows) ? t.input.rows : [];
    return Response.json({ rows, notes: t?.input?.notes || "", truncated: res.stop_reason === "max_tokens" });
  } catch (e) {
    return Response.json({ error: "تعذّر الاستخراج: " + String((e as Error).message || e).slice(0, 200) }, { status: 502 });
  }
};

export const config: Config = { path: "/api/wo-extract", method: ["POST"] };
