import { eq } from "drizzle-orm";
import {
  auditLogs,
  campaigns,
  leads,
  outboundEvents,
  outboundProspects,
  timelineEvents,
} from "../../../db/schema";
import type { BusinessConfig } from "../../config/business";
import { getCommercialDb } from "../../db/commercial";
import { canonicalInstagramUsername } from "../leads/domain";
import {
  buildDiscoveryQualificationReason,
  commercialInstagramProfileSignal,
  isMassAudienceInstagramProfile,
  normalizeDiscoveryStrategy,
  normalizeLocalDiscoveryTerm,
  parseStoredDiscoveryTerms,
  type PublicInstagramCandidate,
} from "./discovery-domain";
import { scorePublicProfile, type OutboundFunnel } from "./domain";
import type {
  ProspectCampaignFitInput,
  ProspectCampaignFitResult,
} from "../../integrations/openai/prospect-qualification";

export type ProspectQualifier = (
  input: ProspectCampaignFitInput,
) => Promise<ProspectCampaignFitResult>;
export type CandidateOutcome =
  "created" | "duplicate" | "blocked" | "low_score" | "ai_rejected";

export async function qualifyAndStoreCandidates(input: {
  campaign: typeof campaigns.$inferSelect;
  candidates: PublicInstagramCandidate[];
  business: BusinessConfig;
  qualify: ProspectQualifier;
  rememberCandidate: (
    candidate: PublicInstagramCandidate,
    username: string,
    outcome: CandidateOutcome,
    reason?: string,
  ) => Promise<void>;
}) {
  const { campaign, candidates, business, qualify, rememberCandidate } = input;
  const db = await getCommercialDb();
  const nowIso = new Date().toISOString();
  const strategy = normalizeDiscoveryStrategy(campaign.discoveryStrategy);
  const keywords = parseStoredDiscoveryTerms(campaign.discoveryKeywords);
  const hashtags = parseStoredDiscoveryTerms(campaign.discoveryHashtags);
  const locations = parseStoredDiscoveryTerms(campaign.discoveryLocations);
  const localNiche =
    normalizeLocalDiscoveryTerm(campaign.discoveryLocalNiche || "") ||
    undefined;
  const localLocation =
    normalizeLocalDiscoveryTerm(campaign.discoveryLocalLocation || "") ||
    undefined;
  let profilesQualified = 0;
  let profilesCreated = 0;
  let skippedDuplicates = 0;
  let skippedBlocked = 0;
  let skippedLowScore = 0;
  const effectiveFunnel: OutboundFunnel =
    strategy === "local_business"
      ? "partner"
      : (campaign.funnelType as OutboundFunnel);
  const configuredMaximumConsumerFollowers = Number(
    process.env.MAX_CONSUMER_DISCOVERY_FOLLOWERS || 100_000,
  );
  const maximumConsumerFollowers = Number.isFinite(
    configuredMaximumConsumerFollowers,
  )
    ? Math.max(1_000, Math.trunc(configuredMaximumConsumerFollowers))
    : 100_000;
  const preparedCandidates: Array<{
    candidate: PublicInstagramCandidate;
    instagramUsername: string;
    lead: typeof leads.$inferSelect | undefined;
    score: ReturnType<typeof scorePublicProfile>;
  }> = [];

  for (const candidate of candidates) {
    const instagramUsername = canonicalInstagramUsername(
      candidate.instagramUsername,
    );
    if (!/^[a-z0-9._]{1,30}$/.test(instagramUsername)) continue;
    const commercialSignal = commercialInstagramProfileSignal(candidate);
    if (
      strategy !== "local_business" &&
      campaign.funnelType === "consumer" &&
      (commercialSignal ||
        isMassAudienceInstagramProfile(candidate, maximumConsumerFollowers))
    ) {
      skippedLowScore += 1;
      await rememberCandidate(
        candidate,
        instagramUsername,
        "low_score",
        commercialSignal
          ? `Perfil com sinais comerciais ou profissionais ("${commercialSignal}"); a campanha aceita somente consumidores finais.`
          : `Audiência acima do limite de ${maximumConsumerFollowers} seguidores para consumidores finais.`,
      );
      continue;
    }
    const [existingProspect] = await db
      .select({ id: outboundProspects.id })
      .from(outboundProspects)
      .where(eq(outboundProspects.instagramUsername, instagramUsername))
      .limit(1);
    if (existingProspect) {
      skippedDuplicates += 1;
      await rememberCandidate(candidate, instagramUsername, "duplicate");
      continue;
    }
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.instagramUsername, instagramUsername))
      .limit(1);
    if (lead?.doNotContact) {
      skippedBlocked += 1;
      await rememberCandidate(
        candidate,
        instagramUsername,
        "blocked",
        "Contato bloqueado por não contato.",
      );
      continue;
    }
    const score = scorePublicProfile(
      {
        category: candidate.profileCategory,
        bio: candidate.profileBio,
        location: candidate.profileLocation,
        publicSignal: candidate.publicSignal,
        funnelType: effectiveFunnel,
        campaignTerms: [
          campaign.segment || "",
          ...keywords,
          ...hashtags,
          localNiche || "",
        ],
        targetLocations: [localLocation || "", ...locations],
        discoverySource:
          strategy === "local_business" ? "local_business" : undefined,
      },
      business,
    );
    if (
      score.score < campaign.discoveryMinimumScore &&
      strategy !== "local_business"
    ) {
      skippedLowScore += 1;
      await rememberCandidate(
        candidate,
        instagramUsername,
        "low_score",
        `Pontuação ${score.score} abaixo do mínimo ${campaign.discoveryMinimumScore}. Sinais compatíveis: ${score.matches.join(", ") || "nenhum"}.`,
      );
      continue;
    }
    preparedCandidates.push({ candidate, instagramUsername, lead, score });
  }

  const aiValidation = await qualify({
    campaign: {
      name: campaign.name,
      funnelType: effectiveFunnel,
      segment: campaign.segment,
      strategy,
      keywords,
      hashtags,
      locations,
      localNiche,
      localLocation,
    },
    candidates: preparedCandidates.map((item) => item.candidate),
  });
  if (!aiValidation.available) {
    throw new Error(
      `Qualificação pela IA rápida indisponível: ${aiValidation.reason}`,
    );
  }
  const aiDecisions = new Map(
    aiValidation.decisions.map((decision) => [decision.index, decision]),
  );

  for (const [candidateIndex, prepared] of preparedCandidates.entries()) {
    const { candidate, instagramUsername, score } = prepared;
    let lead = prepared.lead;
    const aiDecision = aiDecisions.get(candidateIndex);
    if (!aiDecision || !aiDecision.fits || aiDecision.confidence === "low") {
      skippedLowScore += 1;
      await rememberCandidate(
        candidate,
        instagramUsername,
        "ai_rejected",
        aiDecision?.reason || "Evidência insuficiente para a campanha.",
      );
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "campaign_candidate_rejected_by_fast_ai",
        entityType: "instagram_profile",
        entityId: instagramUsername,
        metadata: JSON.stringify({
          campaignId: campaign.id,
          reason: aiDecision?.reason || "Decisão ausente",
          classification: aiDecision?.classification || "unknown",
          confidence: aiDecision?.confidence || "low",
          sendsMessages: false,
        }),
        createdAt: nowIso,
      });
      continue;
    }
    profilesQualified += 1;
    const prospectId = crypto.randomUUID();
    const finalScore =
      strategy === "local_business"
        ? Math.max(score.score, campaign.discoveryMinimumScore)
        : score.score;
    const finalPriority =
      finalScore >= 70 ? "high" : finalScore >= 40 ? "normal" : "low";
    const finalPipelineStage =
      strategy === "local_business" || finalScore >= 40
        ? "qualified"
        : "discovered";
    const qualificationReason = buildDiscoveryQualificationReason({
      query: candidate.discoveryQuery,
      score: finalScore,
      matches: score.matches,
      aiReason: aiDecision.reason,
      aiConfidence: aiDecision.confidence,
    });
    const inserted = await db.transaction(async (tx) => {
      if (!lead) {
        const leadId = crypto.randomUUID();
        await tx
          .insert(leads)
          .values({
            id: leadId,
            instagramUsername,
            name: candidate.name || null,
            leadType: effectiveFunnel === "partner" ? "partner" : "consumer",
            source:
              strategy === "local_business"
                ? `Google Maps · ${campaign.name}`
                : `Descoberta Instagram · ${campaign.name}`,
            segment: campaign.segment,
            score: finalScore,
            icpScore: finalScore,
            pipelineStage: finalPipelineStage,
            channelState: "human_review_required",
            createdAt: nowIso,
            updatedAt: nowIso,
          })
          .onConflictDoNothing();
        [lead] = await tx
          .select()
          .from(leads)
          .where(eq(leads.instagramUsername, instagramUsername))
          .limit(1);
      }
      // Revalida bloqueio e duplicidade depois da IA, dentro da transação.
      [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.instagramUsername, instagramUsername))
        .limit(1);
      if (!lead || lead.doNotContact) return false;
      const [duplicate] = await tx
        .select({ id: outboundProspects.id })
        .from(outboundProspects)
        .where(eq(outboundProspects.instagramUsername, instagramUsername))
        .limit(1);
      if (duplicate) return false;
      const created = await tx
        .insert(outboundProspects)
        .values({
          id: prospectId,
          campaignId: campaign.id,
          leadId: lead.id,
          instagramUsername,
          name: candidate.name || null,
          sourceUrl: candidate.sourceUrl,
          profileCategory: candidate.profileCategory || null,
          profileBio: candidate.profileBio || null,
          profileLocation: candidate.profileLocation || null,
          publicSignal: candidate.publicSignal || null,
          discoverySource:
            strategy === "instagram_followers"
              ? "instagram_followers"
              : strategy === "local_business"
                ? "google_maps"
                : "instagram_browser",
          discoveryQuery: candidate.discoveryQuery,
          qualificationReason,
          funnelType: effectiveFunnel,
          pipelineStage: finalPipelineStage,
          icpScore: finalScore,
          priority: finalPriority,
          contactPolicy: "manual_only",
          status: "identified",
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoNothing()
        .returning({ id: outboundProspects.id });
      if (!created.length) return false;
      await tx.insert(outboundEvents).values({
        id: crypto.randomUUID(),
        prospectId,
        campaignId: campaign.id,
        leadId: lead.id,
        type: "prospect_discovered_automatically",
        metadata: JSON.stringify({
          query: candidate.discoveryQuery,
          sourceUrl: candidate.sourceUrl,
          score: finalScore,
          matches: score.matches,
          aiValidation: aiDecision,
          sent: false,
        }),
        occurredAt: nowIso,
      });
      await tx.insert(timelineEvents).values({
        id: crypto.randomUUID(),
        leadId: lead.id,
        type: "discovered",
        title: "Perfil descoberto automaticamente",
        description: qualificationReason,
        metadata: JSON.stringify({
          campaignId: campaign.id,
          prospectId,
          sent: false,
        }),
        createdAt: nowIso,
      });
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actor: "system",
        action: "outbound_prospect_discovered_automatically",
        entityType: "outbound_prospect",
        entityId: prospectId,
        metadata: JSON.stringify({
          campaignId: campaign.id,
          query: candidate.discoveryQuery,
          aiValidation: aiDecision,
          sent: false,
        }),
        createdAt: nowIso,
      });
      return true;
    });
    if (inserted) {
      profilesCreated += 1;
      await rememberCandidate(candidate, instagramUsername, "created");
    } else {
      skippedDuplicates += 1;
      await rememberCandidate(candidate, instagramUsername, "duplicate");
    }
  }

  return {
    profilesQualified,
    profilesCreated,
    skippedDuplicates,
    skippedBlocked,
    skippedLowScore,
  };
}
