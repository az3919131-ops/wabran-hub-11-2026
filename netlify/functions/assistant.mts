import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";

const SYSTEM = `أنت "مساعد الوبران"، المساعد الذكي لمنصة إدارة أعمال المقاول (الوبران) فرع نجران.
جمهورك: مدير الفرع والإدارة العليا. أجب بالعربية الفصحى المبسطة، باختصار ووضوح، وبالأرقام.
القواعد:
- اعتمد فقط على "بيانات المنصة" المرفقة. لا تخترع أرقاماً. إن كانت البيانات ناقصة أو قديمة فقل ذلك صراحة وحدد ما يلزم إدخاله.
- عند طلب ملخص يومي: ابدأ بجملة واحدة عن وضع الفرع، ثم أخطر 3 أمور تحتاج قراراً، ثم نواقص البيانات.
- اذكر اسم المنصة مصدر كل رقم.
- اقترح إجراءً محدداً (من، ماذا، متى) عند كل مشكلة.
- إذا طُلب تحديث بيانات فاشرح أن التحديث يتم من تبويب "إدخال القراءة" أو "البيانات" في المنصة المعنية.`;

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "طلب غير صالح" }, { status: 400 }); }
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const context = typeof body?.context === "string" ? body.context.slice(0, 60000) : "";
  if (!messages.length) return Response.json({ error: "لا توجد رسالة" }, { status: 400 });

  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: Netlify.env.get("HUB_AI_MODEL") || "claude-sonnet-5-5",
      max_tokens: 1500,
      system: `${SYSTEM}\n\nتاريخ اليوم: ${new Date().toISOString().slice(0, 10)}\n\nبيانات المنصة:\n${context}`,
      messages: messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      })),
    });
    const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    return Response.json({ reply: text, model: res.model });
  } catch (e) {
    return Response.json({ error: "ai_failed", detail: String(e).slice(0, 300) }, { status: 502 });
  }
};

export const config: Config = { path: "/api/assistant", method: "POST", rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] } };
