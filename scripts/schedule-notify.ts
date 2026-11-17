import { Client } from "@upstash/qstash";
import { createHash } from "node:crypto";
import { notifyPublisherConfig } from "../lib/mibess-notify/config";

// Run once after deployment, independently of payment/user requests. The stable
// schedule ID updates this application's schedule without duplicating wakeups.
try {
  const app = new URL(process.env.APP_URL || "");
  if (app.protocol !== "https:" || app.username || app.password || app.pathname !== "/" || app.search || app.hash || !notifyPublisherConfig() ||
    !process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) throw new Error("configuration");
  const scheduleId = `artgian-notify-${createHash("sha256").update(app.origin).digest("hex").slice(0, 16)}`;
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  await client.schedules.create({ scheduleId, destination: `${app.origin}/api/tasks/notify`, cron: "*/2 * * * *", method: "POST", body: "{}", headers: { "Content-Type": "application/json" }, retries: 0 });
  const saved = await client.schedules.get(scheduleId);
  if (saved.destination !== `${app.origin}/api/tasks/notify` || saved.cron !== "*/2 * * * *" || saved.isPaused) throw new Error("verification");
  console.log(`Agendamento recorrente verificado: ${scheduleId}`);
} catch {
  console.error("Não foi possível configurar/verificar o agendamento. Confira APP_URL, ambiente Notify, credenciais e acesso ao QStash.");
  process.exitCode = 1;
}
