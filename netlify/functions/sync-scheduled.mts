import type { Config } from "@netlify/functions";
import { runSync } from "../lib/sync.mts";

// مزامنة تلقائية كل 6 ساعات (UTC 0,6,12,18 = 3، 9 صباحاً، 3، 9 مساءً بتوقيت الرياض).
export default async () => { console.log(await runSync()); };

export const config: Config = { schedule: "0 */6 * * *" };
