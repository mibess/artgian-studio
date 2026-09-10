import { and, eq, inArray, or } from "drizzle-orm";
import {
  auditLogs,
  campaigns,
  jobs,
  leads,
  localBusinessOpportunities,
  outboundProspects,
} from "../../../db/schema";
import { getBusinessConfig } from "../../config/business";
import { getCommercialDb, getSystemSettings } from "../../db/commercial";
import {
  qualifyAndStoreCandidates,
  type CandidateOutcome,
  type ProspectQualifier,
} from "./candidate-qualification";
import {
  parseStoredDiscoveryTerms,
  type PublicInstagramCandidate,
} from "./discovery-domain";
import {
  parseImportedInstagramUsername,
  type InstagramImportPayload,
} from "./instagram-import-domain";

export type InstagramImportResult = {
  status: "completed" | "paused";
  outcome?: "created" | "duplicate" | "rejected";
  reason: string;
  created?: number;
};

export async function enqueueInstagramImport(input: InstagramImportPayload) {
  const instagramUsername = parseImportedInstagramUsername(
    input.instagramUsername,
  );
  if (!instagramUsername) throw new Error("Informe um @ válido do Instagram.");
  const db = await getCommercialDb();
  return db.transaction(async (tx) => {
    const [opportunity] = await tx
      .select()
      .from(localBusinessOpportunities)
      .where(
        and(
          eq(localBusinessOpportunities.id, input.opportunityId),
          eq(localBusinessOpportunities.campaignId, input.campaignId),
        ),
      )
      .limit(1);
    if (!opportunity) throw new Error("Empresa não encontrada nesta campanha.");
    if (opportunity.status === "instagram_found")
      return { status: "resolved" as const };
    const now = new Date().toISOString();
    const key = `import-instagram:${opportunity.id}`;
    const payload = JSON.stringify({ ...input, instagramUsername });
    // Uma única vaga por empresa, inclusive com duplo clique ou outro @ em paralelo.
    const inserted = await tx
      .insert(jobs)
      .values({
        id: crypto.randomUUID(),
        type: "import_instagram_profile",
        payload,
        status: "pending",
        scheduledAt: now,
        createdAt: now,
        idempotencyKey: key,
      })
      .onConflictDoNothing()
      .returning({ id: jobs.id });
    let jobId = inserted[0]?.id;
    if (!jobId) {
      const [existing] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.idempotencyKey, key))
        .limit(1);
      if (!existing) throw new Error("Não foi possível agendar a importação.");
      if (["pending", "running"].includes(existing.status))
        return { status: "pending" as const, jobId: existing.id };
      const reset = await tx
        .update(jobs)
        .set({
          payload,
          status: "pending",
          attempts: 0,
          startedAt: null,
          finishedAt: null,
          lastError: null,
          scheduledAt: now,
        })
        .where(
          and(
            eq(jobs.id, existing.id),
            inArray(jobs.status, ["completed", "dead_letter"]),
          ),
        )
        .returning({ id: jobs.id });
      if (!reset.length)
        throw new Error("Esta importação está aguardando revisão operacional.");
      jobId = existing.id;
    }
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "local_business_instagram_import_requested",
      entityType: "local_business_opportunity",
      entityId: opportunity.id,
      metadata: JSON.stringify({
        instagramUsername,
        campaignId: input.campaignId,
        jobId,
        sent: false,
      }),
      createdAt: now,
    });
    return { status: "queued" as const, jobId };
  });
}

async function reconcileOpportunity(input: InstagramImportPayload) {
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx
      .update(localBusinessOpportunities)
      .set({
        instagramUsername: input.instagramUsername,
        status: "instagram_found",
        reviewedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(localBusinessOpportunities.campaignId, input.campaignId),
          or(
            eq(localBusinessOpportunities.id, input.opportunityId),
            eq(
              localBusinessOpportunities.instagramUsername,
              input.instagramUsername,
            ),
          ),
        ),
      );
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "system",
      action: "local_business_instagram_import_resolved",
      entityType: "local_business_opportunity",
      entityId: input.opportunityId,
      metadata: JSON.stringify({ ...input, sent: false }),
      createdAt: now,
    });
  });
}

export async function executeInstagramImport(
  input: InstagramImportPayload & { jobId: string },
  dependencies: {
    inspect: (input: {
      jobId: string;
      instagramUsername: string;
      knownLocations: string[];
    }) => Promise<PublicInstagramCandidate | null>;
    qualify: ProspectQualifier;
  },
): Promise<InstagramImportResult> {
  const username = parseImportedInstagramUsername(input.instagramUsername);
  if (!username) throw new Error("Perfil do Instagram inválido.");
  input = { ...input, instagramUsername: username };
  if (process.env.INSTAGRAM_DISCOVERY_ENABLED !== "true")
    throw new Error(
      "Leitura do Instagram bloqueada por INSTAGRAM_DISCOVERY_ENABLED.",
    );
  const settings = await getSystemSettings();
  if (
    settings.automation_paused === "true" ||
    settings.discovery_paused === "true"
  ) {
    return {
      status: "paused",
      reason:
        "Importação aguardando liberação da busca nas configurações gerais.",
    };
  }
  const db = await getCommercialDb();
  const [row] = await db
    .select({ opportunity: localBusinessOpportunities, campaign: campaigns })
    .from(localBusinessOpportunities)
    .innerJoin(
      campaigns,
      eq(campaigns.id, localBusinessOpportunities.campaignId),
    )
    .where(
      and(
        eq(localBusinessOpportunities.id, input.opportunityId),
        eq(campaigns.id, input.campaignId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Empresa não encontrada nesta campanha.");
  if (row.opportunity.status === "instagram_found")
    return {
      status: "completed",
      outcome: "duplicate",
      reason: "Empresa já conciliada com um Instagram.",
    };
  const business = await getBusinessConfig();
  if (
    username ===
    parseImportedInstagramUsername(business.company.instagramHandle)
  ) {
    return {
      status: "completed",
      outcome: "rejected",
      reason: "O perfil da própria empresa não pode ser prospectado.",
    };
  }
  const existingProfile = async () => {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.instagramUsername, username))
      .limit(1);
    const [prospect] = await db
      .select()
      .from(outboundProspects)
      .where(eq(outboundProspects.instagramUsername, username))
      .limit(1);
    return { lead, prospect };
  };
  const existing = await existingProfile();
  if (
    existing.lead?.doNotContact ||
    existing.prospect?.status === "disqualified"
  ) {
    return {
      status: "completed",
      outcome: "rejected",
      reason:
        "Perfil bloqueado para contato ou desqualificado. Nenhuma importação foi realizada.",
    };
  }
  if (existing.prospect) {
    await reconcileOpportunity(input);
    return {
      status: "completed",
      outcome: "duplicate",
      reason:
        existing.prospect.campaignId === input.campaignId
          ? "Instagram já cadastrado nesta campanha. Empresa conciliada sem duplicar o prospecto."
          : "Instagram já cadastrado em outra campanha. Empresa conciliada sem duplicar ou mover o prospecto.",
    };
  }
  // A importação é pontual: independe da recorrência, não muda o cursor nem agenda nova busca.
  const candidate = await dependencies.inspect({
    jobId: input.jobId,
    instagramUsername: username,
    knownLocations: [
      ...parseStoredDiscoveryTerms(row.campaign.discoveryLocations),
      row.campaign.discoveryLocalLocation || row.opportunity.location,
    ],
  });
  if (!candidate)
    throw new Error(
      "Não foi possível ler este perfil público. Confira o @ e a sessão do Chrome antes de tentar novamente.",
    );
  if (parseImportedInstagramUsername(candidate.instagramUsername) !== username)
    throw new Error("O Instagram retornou um perfil diferente do informado.");
  const query = `Importação de @${username} · ${row.opportunity.businessName}`;
  const outcomes: Array<{ outcome: CandidateOutcome; reason?: string }> = [];
  const result = await qualifyAndStoreCandidates({
    campaign: row.campaign,
    business,
    qualify: dependencies.qualify,
    candidates: [
      {
        ...candidate,
        instagramUsername: username,
        sourceUrl: `https://www.instagram.com/${username}/`,
        discoveryQuery: query,
        localBusinessUrl: row.opportunity.googleMapsUrl,
      },
    ],
    rememberCandidate: async (_candidate, _username, outcome, reason) => {
      outcomes.push({ outcome, reason });
    },
  });
  const outcome = outcomes[0];
  const final = await existingProfile();
  const accepted =
    (outcome?.outcome === "created" || outcome?.outcome === "duplicate") &&
    final.prospect &&
    final.prospect.status !== "disqualified" &&
    !final.lead?.doNotContact;
  if (accepted) await reconcileOpportunity(input);
  const reason = accepted
    ? result.profilesCreated
      ? "Instagram aprovado e adicionado ao Público. Prepare o rascunho quando quiser."
      : "Instagram já cadastrado; empresa conciliada sem duplicação."
    : outcome?.reason ||
      "O perfil não foi aprovado pelos critérios da campanha.";
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actor: "system",
    action: "local_business_instagram_import_evaluated",
    entityType: "local_business_opportunity",
    entityId: input.opportunityId,
    metadata: JSON.stringify({
      instagramUsername: username,
      outcome: outcome?.outcome,
      reason,
      sent: false,
    }),
    createdAt: new Date().toISOString(),
  });
  return {
    status: "completed",
    outcome: accepted
      ? result.profilesCreated
        ? "created"
        : "duplicate"
      : "rejected",
    created: result.profilesCreated,
    reason,
  };
}
