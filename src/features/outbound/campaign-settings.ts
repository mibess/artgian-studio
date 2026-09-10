import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, campaigns } from "../../../db/schema";
import { getCommercialDb } from "../../db/commercial";

const detailsSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().trim().min(3).max(120),
  source: z.string().trim().min(2).max(120),
  segment: z.string().trim().max(120),
  funnelType: z.enum(["consumer", "partner"]),
  dailyLimit: z.coerce.number().int().min(1).max(30),
  operatingHours: z
    .string()
    .trim()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/),
  operatingTimezone: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((timeZone) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone }).format();
        return true;
      } catch {
        return false;
      }
    }),
});

export async function saveCampaignDetails(input: Record<string, unknown>) {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    const labels: Record<string, string> = {
      name: "Nome: informe de 3 a 120 caracteres.",
      source: "Origem: informe de 2 a 120 caracteres.",
      segment: "Segmento: use até 120 caracteres.",
      funnelType: "Selecione um funil válido.",
      dailyLimit: "Limite de contatos: informe um inteiro entre 1 e 30.",
      operatingHours: "Horário: use HH:MM-HH:MM, por exemplo 09:00-18:00.",
      operatingTimezone:
        "Informe um fuso válido, por exemplo America/Sao_Paulo.",
    };
    throw new Error(
      labels[String(parsed.error.issues[0]?.path[0])] || "Campanha inválida.",
    );
  }
  const { campaignId, ...data } = parsed.data;
  const db = await getCommercialDb();
  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!campaign) throw new Error("Campanha não encontrada.");
    const changes = {
      ...data,
      segment: data.segment || null,
      funnelType:
        campaign.discoveryStrategy === "local_business"
          ? "partner"
          : data.funnelType,
    };
    const now = new Date().toISOString();
    await tx
      .update(campaigns)
      .set({ ...changes, updatedAt: now })
      .where(eq(campaigns.id, campaignId));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "campaign_details_updated",
      entityType: "campaign",
      entityId: campaignId,
      metadata: JSON.stringify({
        previous: Object.fromEntries(
          Object.keys(changes).map((key) => [
            key,
            campaign[key as keyof typeof campaign],
          ]),
        ),
        changes,
        sent: false,
      }),
      createdAt: now,
    });
  });
}
