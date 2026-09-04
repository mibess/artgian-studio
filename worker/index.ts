export {};

try {
  process.loadEnvFile(process.env.WORKER_ENV_FILE || ".env.local");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const [{ runWorkerOnce }, { executeOutboundBrowserJob }, { executeCampaignDiscovery }, { discoverInstagramProfiles }] = await Promise.all([
  import("../src/worker/processor"),
  import("../src/features/outbound/execute"),
  import("../src/features/outbound/discovery"),
  import("../src/integrations/browser/instagram-discovery"),
]);

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

console.log("Worker comercial iniciado. Pressione Ctrl+C para encerrar.");
let consecutiveFailures = 0;
while (running) {
  try {
    const result = await runWorkerOnce(undefined, {
      executeOutboundBrowserJob,
      executeDiscoveryJob: (input) =>
        executeCampaignDiscovery(input, { discover: discoverInstagramProfiles }),
    });
    consecutiveFailures = 0;
    if (!result.processed) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  } catch (error) {
    consecutiveFailures += 1;
    const retryDelay = Math.min(60_000, 2_000 * 2 ** Math.min(5, consecutiveFailures - 1));
    console.error(
      `Worker encontrou uma falha transitória; nova tentativa em ${Math.round(retryDelay / 1_000)}s.`,
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
}
console.log("Worker comercial encerrado com segurança.");
