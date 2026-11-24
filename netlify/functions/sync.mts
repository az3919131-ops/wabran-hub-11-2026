import type { Config } from "@netlify/functions";
import { runSync } from "../lib/sync.mts";
import { currentUser, can, json } from "../lib/auth.mts";

// مزامنة يدوية من زر «مزامنة الآن» — لمن يملك صلاحية المزامنة
export default async (req: Request) => {
  const u = await currentUser(req);
  if (!u) return json(req, { error: "سجّل الدخول أولاً" }, 401);
  if (!can(u, "sync")) return json(req, { error: "لا تملك صلاحية المزامنة" }, 403);
  const report = await runSync();
  return json(req, { ok: true, report });
};

export const config: Config = { path: "/api/sync", method: "POST", rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] } };
