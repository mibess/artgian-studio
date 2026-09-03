import { afterEach, describe, expect, it, vi } from "vitest";
import { getFollowupSchedulerStatus, scheduleFollowupWake } from "../src/worker/followup-scheduler";
import { NextRequest } from "next/server";
import { POST } from "../app/api/tasks/followups/route";
import { parseFollowupFailure } from "../src/worker/followup-alerts";

const original = {
  appUrl: process.env.APP_URL,
  token: process.env.QSTASH_TOKEN,
  current: process.env.QSTASH_CURRENT_SIGNING_KEY,
  next: process.env.QSTASH_NEXT_SIGNING_KEY,
};

afterEach(() => {
  process.env.APP_URL = original.appUrl;
  process.env.QSTASH_TOKEN = original.token;
  process.env.QSTASH_CURRENT_SIGNING_KEY = original.current;
  process.env.QSTASH_NEXT_SIGNING_KEY = original.next;
});

describe("agendador pontual de follow-ups", () => {
  it("mantém o job apenas no banco quando QStash não está configurado", async () => {
    delete process.env.QSTASH_TOKEN;
    const result = await scheduleFollowupWake({
      jobId: "job-1",
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(result.status).toBe("database_only");
  });

  it("publica um único despertar para a rota autenticada", async () => {
    process.env.APP_URL = "https://www.artgian.com.br";
    process.env.QSTASH_TOKEN = "token-de-teste";
    const publish = vi.fn(async (input: { jobId: string; scheduledAt: string; url: string; failureCallback: string; delay: number }) => {
      expect(input.jobId).toBe("job-2");
    });
    const result = await scheduleFollowupWake(
      { jobId: "job-2", scheduledAt: new Date(Date.now() + 60_000).toISOString() },
      { publish },
    );
    expect(result.status).toBe("qstash");
    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0][0]).toMatchObject({
      jobId: "job-2",
      url: "https://www.artgian.com.br/api/tasks/followups",
      failureCallback: "https://www.artgian.com.br/api/tasks/followups/failure",
    });
  });

  it("só informa pronto com publicação e assinatura configuradas", () => {
    process.env.APP_URL = "https://www.artgian.com.br";
    process.env.QSTASH_TOKEN = "token-de-teste";
    process.env.QSTASH_CURRENT_SIGNING_KEY = "chave-atual";
    process.env.QSTASH_NEXT_SIGNING_KEY = "proxima-chave";
    expect(getFollowupSchedulerStatus().ready).toBe(true);
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    expect(getFollowupSchedulerStatus().ready).toBe(false);
  });

  it("rejeita chamadas sem assinatura antes de consultar o job", async () => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    const response = await POST(new NextRequest("https://www.artgian.com.br/api/tasks/followups", {
      method: "POST",
      body: JSON.stringify({ jobId: "job-inexistente" }),
    }));
    expect(response.status).toBe(401);
  });

  it("extrai o job do callback de falha sem confiar no corpo da origem", () => {
    const sourceBody = Buffer.from(JSON.stringify({ jobId: "job-3" })).toString("base64");
    expect(parseFollowupFailure(JSON.stringify({
      sourceBody,
      sourceMessageId: "msg-qstash-1",
      status: 500,
      retried: 3,
    }))).toEqual({
      jobId: "job-3",
      sourceMessageId: "msg-qstash-1",
      status: 500,
      retried: 3,
    });
    expect(parseFollowupFailure("{}")).toBeNull();
  });
});
