import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
    const [{ processInboundMessage }, { getCommercialDb }, { leads }] = await Promise.all([
      import("../src/features/conversations/process-inbound"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const first = await processInboundMessage({ externalMessageId: "external-optout-1", instagramUsername: "@Cliente.Unico", text: "Não quero receber mensagens" });
    const duplicate = await processInboundMessage({ externalMessageId: "external-optout-1", instagramUsername: "cliente.unico", text: "Não quero receber mensagens" });
    expect(first.duplicate).toBe(false);
    expect(first.intent).toBe("opt_out");
    expect(first.doNotContact).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.leadId).toBe(first.leadId);

    const laterInbound = await processInboundMessage({
      externalMessageId: "external-optout-2",
      instagramUsername: "cliente.unico",
      text: "Tenho uma dúvida sobre os produtos",
    });
    const db = await getCommercialDb();
    const [savedLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, first.leadId))
      .limit(1);
    expect(laterInbound.doNotContact).toBe(true);
    expect(laterInbound.draftMessageId).toBeNull();
    expect(savedLead.doNotContact).toBe(true);
    expect(savedLead.channelState).toBe("do_not_contact");
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

  it("envia um rascunho aprovado uma única vez", async () => {
    const [{ processInboundMessage }, { approveAndSendInstagramReply }, { getCommercialDb }, { messages }] = await Promise.all([
      import("../src/features/conversations/process-inbound"),
      import("../src/features/conversations/replies"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const inbound = await processInboundMessage({
      externalMessageId: "external-send-1",
      externalConversationId: "17841412290657201:9988776655",
      instagramUsername: "9988776655",
      text: "Olá, vocês fazem peças personalizadas?",
    });
    expect(inbound.draftMessageId).toBeTruthy();
    const sendText = async ({ recipientId }: { recipientId: string; text: string }) => ({
      recipientId,
      messageId: "meta-message-1",
    });

    const first = await approveAndSendInstagramReply(
      { leadId: inbound.leadId, messageId: inbound.draftMessageId!, body: "Olá! Fazemos sob análise. Pode enviar sua referência?" },
      { sendText },
    );
    const duplicate = await approveAndSendInstagramReply(
      { leadId: inbound.leadId, messageId: inbound.draftMessageId!, body: "Olá! Fazemos sob análise. Pode enviar sua referência?" },
      { sendText },
    );
    expect(first.status).toBe("sent");
    expect(duplicate.status).toBe("already_processed");

    const db = await getCommercialDb();
    const [saved] = await db.select().from(messages).where(eq(messages.id, inbound.draftMessageId!)).limit(1);
    expect(saved).toMatchObject({ status: "sent", externalId: "meta-message-1" });
  });

  it("sincroniza resposta externa e remove o rascunho que ficou pendente", async () => {
    const [
      { processInboundMessage },
      { recordExternalOutboundMessage },
      { getCommercialDb },
      { messages },
    ] = await Promise.all([
      import("../src/features/conversations/process-inbound"),
      import("../src/features/conversations/process-external-outbound"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const inbound = await processInboundMessage({
      externalMessageId: "external-sync-inbound-1",
      externalConversationId: "business-sync:lead-sync",
      instagramUsername: "lead-sync",
      text: "Quanto fica o envio para meu CEP?",
    });
    const recorded = await recordExternalOutboundMessage({
      externalMessageId: "external-sync-outbound-1",
      externalConversationId: "business-sync:lead-sync",
      instagramUsername: "lead-sync",
      text: "Envie seu CEP aqui e calculamos o frete para você.",
      sentAt: "2026-09-09T00:43:19.000Z",
      source: "Instagram · Anúncio",
    });
    const duplicate = await recordExternalOutboundMessage({
      externalMessageId: "external-sync-outbound-1",
      externalConversationId: "business-sync:lead-sync",
      instagramUsername: "lead-sync",
      text: "Envie seu CEP aqui e calculamos o frete para você.",
    });

    expect(recorded.status).toBe("recorded");
    expect(duplicate.status).toBe("duplicate");
    const db = await getCommercialDb();
    const savedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, inbound.conversationId));
    expect(savedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalId: "external-sync-outbound-1",
          direction: "outbound",
          sender: "external",
          status: "sent",
        }),
        expect.objectContaining({
          id: inbound.draftMessageId,
          status: "superseded",
        }),
      ]),
    );
  });
});
