export {};

try {
  process.loadEnvFile(process.env.WORKER_ENV_FILE || ".env.local");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const [{ runWorkerOnce }, { executeOutboundBrowserJob }] = await Promise.all([
  import("../src/worker/processor"),
  import("../src/features/outbound/execute"),
]);

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

console.log("Worker comercial iniciado. Pressione Ctrl+C para encerrar.");
while (running) {
  const result = await runWorkerOnce(undefined, { executeOutboundBrowserJob });
  if (!result.processed) await new Promise((resolve) => setTimeout(resolve, 2_000));
}
console.log("Worker comercial encerrado com segurança.");
