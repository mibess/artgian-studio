import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const testDir = path.join(process.cwd(), ".test-tmp");
const databasePath = path.join(testDir, `artgian-ai-test-${process.pid}.db`);

describe("rascunhos assistidos pela OpenAI", () => {
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.COMMERCIAL_DEMO_MODE = "false";
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      await unlink(`${databasePath}${suffix}`).catch(() => undefined);
    }
  });

  it("aprimora uma única vez e mantém a mensagem como rascunho", async () => {
    const [
      { processInboundMessage },
      { enhanceReplyDraftWithAi },
      { getCommercialDb },
      { messages, timelineEvents },
    ] = await Promise.all([
      import("../src/features/conversations/process-inbound"),
      import("../src/features/conversations/replies"),
      import("../src/db/commercial"),
      import("../db/schema"),
    ]);
    const inbound = await processInboundMessage({
      externalMessageId: "external-ai-draft-1",
      instagramUsername: "cliente.ia",
      text: "Oi, vocês fazem presentes personalizados?",
    });
    let generationCalls = 0;
    const generateDecision = async () => {
      generationCalls += 1;
      return {
        intent: "asked_customization" as const,
        action: "request_reference" as const,
        reason: "É preciso entender a ideia antes de confirmar viabilidade",
        message: "Oi! Podemos analisar sua ideia. Você tem uma referência do presente que imaginou?",
        requiresHuman: false,
        source: "openai" as const,
      };
    };
    const result = await enhanceReplyDraftWithAi(
      { leadId: inbound.leadId, messageId: inbound.draftMessageId! },
      { generateDecision },
    );
    expect(result.status).toBe("enhanced");
    const duplicate = await enhanceReplyDraftWithAi(
      { leadId: inbound.leadId, messageId: inbound.draftMessageId! },
      { generateDecision },
    );
    expect(duplicate.status).toBe("already_enhanced");
    expect(generationCalls).toBe(1);

    const db = await getCommercialDb();
    const [draft] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, inbound.draftMessageId!))
      .limit(1);
    expect(draft).toMatchObject({
      status: "draft",
      body: "Oi! Podemos analisar sua ideia. Você tem uma referência do presente que imaginou?",
      intent: "asked_customization",
      action: "request_reference",
    });
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.leadId, inbound.leadId));
    expect(events.some((event) => event.type === "ai_draft")).toBe(true);
  });
});
