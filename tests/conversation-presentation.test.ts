import { describe, expect, it } from "vitest";
import { isConversationMessageVisible } from "../src/features/conversations/presentation";

describe("conversation presentation", () => {
  it("oculta rascunhos substituídos que nunca foram enviados", () => {
    expect(isConversationMessageVisible({ status: "superseded" })).toBe(false);
  });

  it.each(["received", "draft", "failed", "sending", "send_uncertain", "sent"])(
    "mantém mensagens com status %s no histórico",
    (status) => {
      expect(isConversationMessageVisible({ status })).toBe(true);
    },
  );
});
