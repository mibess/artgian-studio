import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unlink } from "node:fs/promises";
import path from "node:path";

const databasePath = path.join("/tmp", `artgian-test-${process.pid}.db`);

describe("processamento inbound persistente", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("deduplica eventos e respeita opt-out", async () => {
    const { processInboundMessage } = await import("../src/features/conversations/process-inbound");
    const first = await processInboundMessage({ externalMessageId: "external-optout-1", instagramUsername: "@Cliente.Unico", text: "Não quero receber mensagens" });
    const duplicate = await processInboundMessage({ externalMessageId: "external-optout-1", instagramUsername: "cliente.unico", text: "Não quero receber mensagens" });
    expect(first.duplicate).toBe(false);
    expect(first.intent).toBe("opt_out");
    expect(first.doNotContact).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.leadId).toBe(first.leadId);
  });

  it("cria briefing para pedido de preço com quantidade e prazo", async () => {
    const { processInboundMessage } = await import("../src/features/conversations/process-inbound");
    const result = await processInboundMessage({ externalMessageId: "external-quote-1", instagramUsername: "cliente.orcamento", text: "Quanto custa? Preciso de 12 unidades para 20/09." });
    expect(result.intent).toBe("asked_price");
    expect(result.score.total).toBeGreaterThan(40);
    expect(result.action).toBe("collect_requirement");
  });

  it("responde preço somente quando ele existe no catálogo", async () => {
    const [{ getCommercialDb }, { catalogProducts }, { processInboundMessage }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/features/conversations/process-inbound"),
    ]);
    const db = await getCommercialDb();
    await db.insert(catalogProducts).values({ id: "catalog-test-price", name: "Bandeja Aurora", category: "Decoração", basePriceCents: 8900, pricingType: "fixed", active: true });
    const result = await processInboundMessage({ externalMessageId: "external-price-verified", instagramUsername: "cliente.catalogo", text: "Quanto custa a Bandeja Aurora?" });
    expect(result.action).toBe("show_product");
    expect(result.suggestedMessage).toContain("R$ 89,00");
    expect(result.suggestedMessage).not.toMatch(/prazo|dias úteis/i);
  });
});
