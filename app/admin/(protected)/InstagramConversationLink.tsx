import { ExternalLink } from "lucide-react";

export function InstagramConversationLink({ conversation }: {
  conversation: { id: string; externalId: string | null; channel: string };
}) {
  if (conversation.channel !== "instagram") return null;
  const comment = conversation.externalId?.startsWith("comment:");
  return <a
    href={`/api/admin/conversations/${encodeURIComponent(conversation.id)}/instagram`}
    target="_blank"
    rel="noopener noreferrer"
    title="Abre em uma nova aba. Use a conta do Instagram que recebeu este contato."
    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#dfe2de] bg-white px-3 py-2 text-[10px] font-bold text-[#526873] transition hover:border-[#d96245] hover:text-[#d96245]"
  >
    <ExternalLink size={13} aria-hidden="true" />
    {comment ? "Ver comentário no Instagram" : "Abrir conversa no Instagram"}
  </a>;
}
