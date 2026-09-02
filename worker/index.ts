import { runWorkerOnce } from "../src/worker/processor";

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

console.log("Worker comercial iniciado. Pressione Ctrl+C para encerrar.");
while (running) {
  const result = await runWorkerOnce();
  if (!result.processed) await new Promise((resolve) => setTimeout(resolve, 2_000));
}
console.log("Worker comercial encerrado com segurança.");
