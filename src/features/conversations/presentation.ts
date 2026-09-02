export function isConversationMessageVisible(message: { status: string }) {
  return message.status !== "superseded";
}
