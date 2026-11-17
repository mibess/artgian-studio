import { systemSettings } from "../../db/schema";
import { getCommercialDb, getSystemSettings } from "../db/commercial";
import { resolveAutomationControls } from "../features/automation/domain";

export type WorkerHeartbeatStatus = "idle" | "working" | "paused" | "error" | "stopped";

export type WorkerHeartbeat = {
  at: string;
  status: WorkerHeartbeatStatus;
  browserConfigured: boolean;
  discoveryEnabled: boolean;
  outboundEnabled: boolean;
  qualificationConfigured: boolean;
};

export async function saveWorkerHeartbeat(heartbeat: WorkerHeartbeat) {
  const db = await getCommercialDb();
  const value = JSON.stringify(heartbeat);
  await db.insert(systemSettings).values({
    key: "local_worker_heartbeat",
    value,
    updatedAt: heartbeat.at,
  }).onConflictDoUpdate({
    target: systemSettings.key,
    set: { value, updatedAt: heartbeat.at },
  });
}

/** One write at a time, including when a job takes longer than the reporting interval. */
export function startWorkerHeartbeat(options: {
  persist?: (heartbeat: WorkerHeartbeat) => Promise<void>;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  intervalMs?: number;
  onError?: () => void;
} = {}) {
  const persist = options.persist || saveWorkerHeartbeat;
  const env = options.env || process.env;
  const now = options.now || (() => new Date());
  let status: WorkerHeartbeatStatus = "paused";
  let inFlight: Promise<void> | undefined;
  let stopped = false;

  function pulse() {
    if (inFlight) return inFlight;
    const heartbeat: WorkerHeartbeat = {
      at: now().toISOString(),
      status,
      browserConfigured: Boolean(env.CHROME_CDP_URL?.trim() && env.CHROME_PROFILE_DIR?.trim()),
      discoveryEnabled: env.INSTAGRAM_DISCOVERY_ENABLED === "true",
      outboundEnabled: env.OUTBOUND_AUTOMATION_ENABLED === "true" && env.BROWSER_SEND_ENABLED === "true",
      qualificationConfigured: Boolean(env.OPENAI_API_KEY?.trim() && env.OPENAI_MODEL_FAST?.trim()),
    };
    inFlight = Promise.resolve()
      .then(() => persist(heartbeat))
      .catch(() => {
        // Database error details can contain credentials or customer data.
        try { options.onError?.(); } catch { /* Reporting must not stop the worker. */ }
      })
      .finally(() => { inFlight = undefined; });
    return inFlight;
  }

  const timer = setInterval(() => { void pulse(); }, options.intervalMs || 30_000);
  timer.unref?.();
  void pulse();

  return {
    setStatus(next: WorkerHeartbeatStatus) {
      if (!stopped) status = next;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      status = "stopped";
      // Finish the prior write before the final status so it cannot overwrite stopped.
      await inFlight;
      await pulse();
    },
  };
}

/** A failed settings read never grants permission to claim or execute a job. */
export async function runLocalWorkerCycle<T>(
  run: () => Promise<T>,
  heartbeat: { setStatus: (status: WorkerHeartbeatStatus) => void },
  loadSettings: () => Promise<Record<string, string>> = getSystemSettings,
  shouldContinue: () => boolean = () => true,
): Promise<{ allowed: false } | { allowed: true; result: T }> {
  try {
    const controls = resolveAutomationControls(await loadSettings());
    if (!shouldContinue() || !controls.localWorkerEnabled) {
      heartbeat.setStatus("paused");
      return { allowed: false };
    }
    heartbeat.setStatus("working");
    const result = await run();
    heartbeat.setStatus("idle");
    return { allowed: true, result };
  } catch (error) {
    heartbeat.setStatus("error");
    throw error;
  }
}
