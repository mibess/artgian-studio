export {};

try {
  process.loadEnvFile(process.env.WORKER_ENV_FILE || ".env.local");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const [{ runWorkerOnce }, { executeOutboundBrowserJob }, { executeCampaignDiscovery }, { discoverInstagramProfiles, inspectInstagramProfile }, { validateProspectCampaignFits }, { executeInstagramImport }, { startWorkerHeartbeat, runLocalWorkerCycle }] = await Promise.all([
  import("../src/worker/processor"),
  import("../src/features/outbound/execute"),
  import("../src/features/outbound/discovery"),
  import("../src/integrations/browser/instagram-discovery"),
  import("../src/integrations/openai/prospect-qualification"),
  import("../src/features/outbound/instagram-import"),
  import("../src/worker/heartbeat"),
]);

let running = true;
let wake: (() => void) | undefined;
function stop() { running = false; wake?.(); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function wait(ms: number) {
  if (!running) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); wake = undefined; resolve(); };
    const timer = setTimeout(finish, ms);
    wake = finish;
  });
}

const heartbeat = startWorkerHeartbeat({
  onError: () => console.error("Não foi possível comunicar o estado do worker ao painel; uma nova tentativa será feita."),
});

console.log("Worker comercial iniciado. A execução depende da permissão na central Automação e IA. Pressione Ctrl+C para encerrar.");
let consecutiveFailures = 0;
try {
  while (running) {
    try {
      const cycle = await runLocalWorkerCycle(() => runWorkerOnce(undefined, {
        executeOutboundBrowserJob,
        executeInstagramImportJob: (input) => executeInstagramImport(input, {
          inspect: inspectInstagramProfile,
          qualify: validateProspectCampaignFits,
        }),
        executeDiscoveryJob: (input) =>
          executeCampaignDiscovery(input, {
            discover: discoverInstagramProfiles,
            qualify: validateProspectCampaignFits,
          }),
      }), heartbeat, undefined, () => running);
      consecutiveFailures = 0;
      if (!cycle.allowed || !cycle.result.processed) {
        await wait(cycle.allowed ? 2_000 : 5_000);
      }
    } catch {
      consecutiveFailures += 1;
      const retryDelay = Math.min(60_000, 2_000 * 2 ** Math.min(5, consecutiveFailures - 1));
      console.error(
        `Worker encontrou uma falha transitória; nova tentativa em ${Math.round(retryDelay / 1_000)}s.`,
      );
      await wait(retryDelay);
    }
  }
} finally {
  await heartbeat.stop();
}
console.log("Worker comercial encerrado com segurança.");
