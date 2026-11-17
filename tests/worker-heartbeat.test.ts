import { afterEach, describe, expect, it, vi } from "vitest";
import { runLocalWorkerCycle, startWorkerHeartbeat } from "../src/worker/heartbeat";

afterEach(() => vi.useRealTimers());

describe("permissão do worker local", () => {
  it.each([{}, { local_worker_enabled: "false" }] as Record<string, string>[])("mantém tarefas intactas quando pausado: %j", async (settings) => {
    const run = vi.fn();
    const setStatus = vi.fn();
    expect(await runLocalWorkerCycle(run, { setStatus }, async () => settings)).toEqual({ allowed: false });
    expect(run).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("paused");
  });

  it("não processa tarefas quando a leitura da permissão falha", async () => {
    const run = vi.fn();
    const setStatus = vi.fn();
    await expect(runLocalWorkerCycle(run, { setStatus }, async () => { throw new Error("indisponível"); }))
      .rejects.toThrow("indisponível");
    expect(run).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("error");
  });

  it("não inicia uma tarefa se o encerramento chegou durante a leitura da permissão", async () => {
    const run = vi.fn();
    let running = true;
    expect(await runLocalWorkerCycle(run, { setStatus: vi.fn() }, async () => {
      running = false;
      return { local_worker_enabled: "true" };
    }, () => running)).toEqual({ allowed: false });
    expect(run).not.toHaveBeenCalled();
  });

  it("reconsulta a permissão entre tarefas e respeita uma pausa posterior", async () => {
    const run = vi.fn().mockResolvedValue({ processed: true });
    const setStatus = vi.fn();
    const settings = { local_worker_enabled: "true" };
    expect(await runLocalWorkerCycle(run, { setStatus }, async () => settings))
      .toEqual({ allowed: true, result: { processed: true } });
    settings.local_worker_enabled = "false";
    await runLocalWorkerCycle(run, { setStatus }, async () => settings);
    expect(run).toHaveBeenCalledTimes(1);
    expect(setStatus.mock.calls.map(([state]) => state)).toEqual(["working", "idle", "paused"]);
  });
});

describe("comunicação periódica do worker", () => {
  it("continua reportando durante uma tarefa longa e registra a parada final", async () => {
    vi.useFakeTimers();
    const persist = vi.fn().mockResolvedValue(undefined);
    const heartbeat = startWorkerHeartbeat({ persist, env: {
      CHROME_CDP_URL: "http://localhost:9222", CHROME_PROFILE_DIR: "/dedicated/profile",
      INSTAGRAM_DISCOVERY_ENABLED: "true", OUTBOUND_AUTOMATION_ENABLED: "true", BROWSER_SEND_ENABLED: "false",
      OPENAI_API_KEY: "secret-never-recorded", OPENAI_MODEL_FAST: "example-model",
    } });
    await vi.advanceTimersByTimeAsync(0);
    let finish!: () => void;
    const task = runLocalWorkerCycle(
      () => new Promise<void>((resolve) => { finish = resolve; }),
      heartbeat,
      async () => ({ local_worker_enabled: "true" }),
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "working", browserConfigured: true, discoveryEnabled: true,
      outboundEnabled: false, qualificationConfigured: true,
    }));
    expect(JSON.stringify(persist.mock.calls)).not.toContain("secret-never-recorded");
    finish();
    await task;
    await heartbeat.stop();
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ status: "stopped" }));
    const count = persist.mock.calls.length;
    await vi.advanceTimersByTimeAsync(90_000);
    expect(persist).toHaveBeenCalledTimes(count);
  });

  it("serializa gravações lentas e faz stopped prevalecer sobre o estado anterior", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }))
      .mockResolvedValue(undefined);
    const heartbeat = startWorkerHeartbeat({ persist, env: {} });
    await vi.advanceTimersByTimeAsync(90_000);
    expect(persist).toHaveBeenCalledTimes(1);
    const stopped = heartbeat.stop();
    release();
    await stopped;
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ status: "stopped" }));
  });

  it("tenta novamente após falha de banco sem propagar detalhes ou rejeições", async () => {
    vi.useFakeTimers();
    const persist = vi.fn().mockRejectedValue(new Error("sensitive database failure"));
    const onError = vi.fn();
    const heartbeat = startWorkerHeartbeat({ persist, env: {}, onError });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls).toEqual([[], []]);
    await expect(heartbeat.stop()).resolves.toBeUndefined();
  });
});
