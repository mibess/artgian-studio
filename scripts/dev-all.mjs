import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = [
  spawn(command, ["dev"], { stdio: "inherit", env: process.env }),
  spawn(command, ["worker"], { stdio: "inherit", env: process.env }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on("exit", (code) => {
    stop();
    process.exitCode = code || 0;
  });
  child.on("error", (error) => {
    console.error("Não foi possível iniciar o processo local:", error.message);
    stop();
    process.exitCode = 1;
  });
}
