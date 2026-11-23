import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

// يعمل يومياً 05:10 UTC = 8:10 صباحاً بتوقيت الرياض (UTC+3 بلا توقيت صيفي).
// يقرأ آخر سياق رفعته البوابة، ويولّد ملخص الإدارة العليا ويحفظه في القاعدة.
export default async () => {
  const store = getStore({ name: "wabran-hub", consistency: "strong" });
  const ctx = (await store.get("context", { type: "json" })) as { text?: string; at?: string } | null;
  if (!ctx?.text) { console.log("no context yet"); return; }
  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY) { console.log("AI gateway inactive"); return; }
  const client = new Anthropic();
  const res = await client.messages.create({
    model: Netlify.env.get("HUB_AI_MODEL") || "claude-sonnet-5-5",
    max_tokens: 900,
    system: "أنت مساعد الإدارة العليا لفرع الوبران بنجران. اكتب ملخصاً يومياً بالعربية في 6 أسطر كحد أقصى: جملة عن وضع الفرع، ثم أخطر 3 أمور تحتاج قراراً مع الإجراء المقترح، ثم نواقص البيانات. لا تخترع أرقاماً.",
    messages: [{ role: "user", content: `تاريخ اليوم ${new Date().toISOString().slice(0, 10)}. بيانات المنصة (حُدّثت ${ctx.at}):\n${ctx.text.slice(0, 60000)}` }],
  });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  await store.setJSON("summary", { text, at: new Date().toISOString(), contextAt: ctx.at, by: "daily" });
};

export const config: Config = { schedule: "10 5 * * *" };
