import type { Config } from "@netlify/functions";
import { runSync } from "../lib/sync.mts";

// مزامنة يدوية من زر «مزامنة الآن» في البوابة.
export default async (req: Request) => {
  const pin = Netlify.env.get("HUB_ADMIN_PIN");
  if (pin && req.headers.get("x-hub-pin") !== pin) return Response.json({ error: "رمز الإدارة غير صحيح" }, { status: 401 });
  const report = await runSync();
  return Response.json({ ok: true, report });
};

export const config: Config = { path: "/api/sync", method: "POST", rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] } };
