import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-handoff-test-${process.pid}.db`);

describe("handoff navegador para API oficial", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("transfere a propriedade do fio quando a resposta chega pelo webhook", async () => {
    const [{ getCommercialDb }, schema, { processInboundMessage }, { approveAndSendInstagramReply }] = await Promise.all([
      import("../src/db/commercial"),
      import("../db/schema"),
      import("../src/features/conversations/process-inbound"),
      import("../src/features/conversations/replies"),
    ]);
    const db = await getCommercialDb();
    const before = new Date(Date.now() - 5 * 60 * 1_000).toISOString();
    await db.insert(schema.leads).values({
      id: "handoff-lead",
      instagramUsername: "handoff.teste",
      source: "Outbound · Teste",
      pipelineStage: "contacted",
      channelState: "waiting_inbound_reply",
      createdAt: before,
      updatedAt: before,
    });
    await db.insert(schema.campaigns).values({
      id: "handoff-campaign",
      name: "Teste",
      source: "Instagram",
      createdAt: before,
      updatedAt: before,
    });
    await db.insert(schema.outboundProspects).values({
      id: "handoff-prospect",
      campaignId: "handoff-campaign",
      leadId: "handoff-lead",
      instagramUsername: "handoff.teste",
      qualificationReason: "Perfil de teste compatível",
      status: "waiting_reply",
      pipelineStage: "contacted",
      contactedAt: before,
      createdAt: before,
      updatedAt: before,
    });
    await db.insert(schema.conversations).values({
      id: "handoff-conversation",
      leadId: "handoff-lead",
      externalId: "browser:handoff.teste",
      channelOwner: "browser",
      lastMessageAt: before,
      createdAt: before,
      updatedAt: before,
    });
    await db.insert(schema.messages).values({
      id: "handoff-first-contact",
      conversationId: "handoff-conversation",
      direction: "outbound",
      sender: "assistant",
      body: "Posso te contar uma ideia?",
      status: "sent",
      sentAt: before,
      createdAt: before,
    });

    const inbound = await processInboundMessage({
      externalMessageId: "handoff-inbound-message",
      externalConversationId: "123:456",
      instagramUsername: "handoff.teste",
      text: "Sim, tenho interesse",
    });
    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, "handoff-conversation"));
    const [prospect] = await db
      .select()
      .from(schema.outboundProspects)
      .where(eq(schema.outboundProspects.id, "handoff-prospect"));
    expect(conversation.externalId).toBe("123:456");
    expect(conversation.channelOwner).toBe("api");
    expect(conversation.handedOffAt).toBeTruthy();
    expect(prospect.status).toBe("replied");
    expect(prospect.pipelineStage).toBe("replied");

    const sent = await approveAndSendInstagramReply(
      {
        leadId: inbound.leadId,
        messageId: inbound.draftMessageId!,
        body: "Que ótimo! Qual produto chamou sua atenção?",
      },
      { sendText: async ({ recipientId }) => ({ recipientId, messageId: "api-reply" }) },
    );
    expect(sent.status).toBe("sent");
    const handoffEvents = await db
      .select()
      .from(schema.outboundEvents)
      .where(eq(schema.outboundEvents.type, "inbound_reply_received"));
    expect(handoffEvents).toHaveLength(1);

    const nextInbound = await processInboundMessage({
      externalMessageId: "handoff-inbound-message-2",
      externalConversationId: "123:456",
      instagramUsername: "456",
      text: "Quero entender as opções",
    });
    expect(nextInbound.leadId).toBe("handoff-lead");
    const matchingLeads = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.instagramUsername, "handoff.teste"));
    expect(matchingLeads).toHaveLength(1);
  });
});
