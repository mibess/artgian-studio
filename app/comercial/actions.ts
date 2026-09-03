"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { processInboundMessage } from "../../src/features/conversations/process-inbound";
import { setSystemSetting } from "../../src/db/commercial";
import { getBusinessConfig, saveBusinessFields } from "../../src/config/business";
import { getCommercialDb, getSystemSettings } from "../../src/db/commercial";
import { auditLogs, briefings, campaigns, catalogProducts, commercialOrders, conversations, exceptions, experiments, jobs, leads, messages, outboundEvents, outboundProspects, quoteRequests, timelineEvents } from "../../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { prepareWhatsAppHandoff } from "../../src/integrations/whatsapp/handoff";
import { approveAndSendInstagramReply, createReplyDraftForLead, enhanceReplyDraftWithAi } from "../../src/features/conversations/replies";
import { runInstagramMaintenance } from "../../src/integrations/instagram/maintenance";
import { canonicalInstagramUsername } from "../../src/features/leads/domain";
import { isInstagramReplyWindowOpen } from "../../src/integrations/instagram/send";
import { assignExperimentVariant, buildSafeOutboundOpening, isValidOutboundTransition, OUTBOUND_FUNNELS, OUTBOUND_PIPELINES, scorePublicProfile, type OutboundFunnel } from "../../src/features/outbound/domain";
import { generateOutboundOpening } from "../../src/integrations/openai/conversation-engine";
import { requireAdminAccess } from "../../src/auth/admin";

export async function updateAutomationSetting(formData: FormData) {
  await requireAdminAccess();
  const allowed = new Set([
    "automation_paused",
    "outbound_paused",
    "followups_paused",
    "auto_replies_paused",
  ]);
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "false");
  if (!allowed.has(key) || !["true", "false"].includes(value)) {
    throw new Error("Configuração inválida.");
  }
  await setSystemSetting(key, value);
  revalidatePath("/comercial", "layout");
}

export async function simulateInbound(formData: FormData) {
  await requireAdminAccess();
  const username = String(formData.get("username") || "").trim();
  const text = String(formData.get("message") || "").trim();
  if (username.length < 2 || text.length < 2) {
    redirect("/comercial/conversas?erro=Preencha+o+perfil+e+a+mensagem");
  }
  const result = await processInboundMessage({
    externalMessageId: `manual-${crypto.randomUUID()}`,
    instagramUsername: username,
    text,
    source: "Simulação inbound",
  });
  if (result.draftMessageId) {
    await enhanceReplyDraftWithAi({
      leadId: result.leadId,
      messageId: result.draftMessageId,
    });
  }
  revalidatePath("/comercial", "layout");
  redirect(`/comercial/leads/${result.leadId}?simulado=1`);
}

export async function updateBusinessConfiguration(formData: FormData) {
  await requireAdminAccess();
  const whatsappLink = String(formData.get("whatsappLink") || "").trim();
  const fulfillmentGeography = String(formData.get("fulfillmentGeography") || "").trim();
  if (whatsappLink && whatsappLink !== "A_DEFINIR") {
    let url: URL;
    try {
      url = new URL(whatsappLink);
    } catch {
      redirect("/comercial/configuracoes?erro=Informe+um+link+completo+e+válido");
    }
    if (!['wa.me', 'api.whatsapp.com'].includes(url.hostname)) {
      redirect("/comercial/configuracoes?erro=Use+um+link+oficial+do+WhatsApp");
    }
  }
  await saveBusinessFields({
    whatsappLink: whatsappLink || "A_DEFINIR",
    fulfillmentGeography: fulfillmentGeography || "A_DEFINIR",
  });
  revalidatePath("/comercial", "layout");
  redirect("/comercial/configuracoes?salvo=1");
}

export async function addCatalogProduct(formData: FormData) {
  await requireAdminAccess();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const productionTime = String(formData.get("productionTime") || "").trim();
  const rawPrice = String(formData.get("basePrice") || "").replace(",", ".").trim();
  if (name.length < 2) redirect("/comercial/produtos?erro=Informe+o+nome+do+produto");
  const basePriceCents = rawPrice ? Math.round(Number(rawPrice) * 100) : null;
  if (rawPrice && (!Number.isFinite(basePriceCents) || basePriceCents! < 0)) redirect("/comercial/produtos?erro=Preço+inválido");
  const db = await getCommercialDb();
  await db.insert(catalogProducts).values({
    id: crypto.randomUUID(),
    name,
    category: category || null,
    description: description || null,
    basePriceCents,
    pricingType: basePriceCents == null ? "quote" : "fixed",
    productionTime: productionTime || null,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/comercial/produtos");
  redirect("/comercial/produtos?salvo=1");
}

export async function createCampaign(formData: FormData) {
  await requireAdminAccess();
  const name = String(formData.get("name") || "").trim();
  const source = String(formData.get("source") || "").trim();
  const segment = String(formData.get("segment") || "").trim();
  const funnelType = String(formData.get("funnelType") || "consumer");
  const requestedDailyLimit = Number(formData.get("dailyLimit") || 5);
  const dailyLimit = Math.min(30, Math.max(1, Math.trunc(requestedDailyLimit)));
  const operatingHours = String(formData.get("operatingHours") || "09:00-18:00").trim();
  if (name.length < 3 || name.length > 120 || source.length < 2 || source.length > 120 || segment.length > 120) {
    redirect("/comercial/campanhas?erro=Informe+nome+e+origem+da+campanha");
  }
  if (!Number.isFinite(requestedDailyLimit)) {
    redirect("/comercial/campanhas?erro=Informe+um+limite+diário+válido");
  }
  if (!OUTBOUND_FUNNELS.includes(funnelType as OutboundFunnel)) {
    redirect("/comercial/campanhas?erro=Funil+de+campanha+inválido");
  }
  const hours = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(operatingHours);
  if (
    !hours ||
    Number(hours[1]) > 23 ||
    Number(hours[2]) > 59 ||
    Number(hours[3]) > 23 ||
    Number(hours[4]) > 59
  ) {
    redirect("/comercial/campanhas?erro=Use+uma+janela+como+09:00-18:00");
  }
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(campaigns).values({
      id,
      name,
      source,
      segment: segment || null,
      funnelType,
      dailyLimit,
      operatingHours,
      operatingTimezone: process.env.OPERATING_TIMEZONE || "America/Sao_Paulo",
      status: "draft",
      outboundEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "campaign_created",
      entityType: "campaign",
      entityId: id,
      metadata: JSON.stringify({ outboundEnabled: false }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?salvo=1");
}

function validInstagramProfileUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["instagram.com", "www.instagram.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function addOutboundProspect(formData: FormData) {
  await requireAdminAccess();
  const campaignId = String(formData.get("campaignId") || "");
  const instagramUsername = canonicalInstagramUsername(String(formData.get("instagramUsername") || ""));
  const name = String(formData.get("name") || "").trim();
  const sourceUrl = String(formData.get("sourceUrl") || "").trim();
  const profileCategory = String(formData.get("profileCategory") || "").trim();
  const profileBio = String(formData.get("profileBio") || "").trim();
  const profileLocation = String(formData.get("profileLocation") || "").trim();
  const publicSignal = String(formData.get("publicSignal") || "").trim();
  const qualificationReason = String(formData.get("qualificationReason") || "").trim();
  if (!campaignId || !/^[a-z0-9._]{1,30}$/.test(instagramUsername)) {
    redirect("/comercial/campanhas?erro=Informe+um+perfil+válido+do+Instagram");
  }
  if (!validInstagramProfileUrl(sourceUrl)) {
    redirect("/comercial/campanhas?erro=A+fonte+deve+ser+um+link+oficial+do+Instagram");
  }
  if (qualificationReason.length < 10 || qualificationReason.length > 500) {
    redirect("/comercial/campanhas?erro=Explique+em+10+a+500+caracteres+por+que+o+perfil+é+relevante");
  }
  if (
    name.length > 120 ||
    sourceUrl.length > 300 ||
    profileCategory.length > 120 ||
    profileBio.length > 500 ||
    profileLocation.length > 120 ||
    publicSignal.length > 300
  ) {
    redirect("/comercial/campanhas?erro=Um+dos+campos+excede+o+limite+permitido");
  }

  const db = await getCommercialDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) redirect("/comercial/campanhas?erro=Campanha+não+encontrada");

  const business = await getBusinessConfig();
  const profileScore = scorePublicProfile(
    {
      category: profileCategory,
      bio: profileBio,
      location: profileLocation,
      publicSignal,
      funnelType: campaign.funnelType as OutboundFunnel,
    },
    business,
  );

  let [lead] = await db.select().from(leads).where(eq(leads.instagramUsername, instagramUsername)).limit(1);
  if (lead?.doNotContact) {
    redirect("/comercial/campanhas?erro=Este+perfil+está+na+lista+permanente+de+não+contato");
  }
  const existingProspects = await db
    .select({ status: outboundProspects.status })
    .from(outboundProspects)
    .where(eq(outboundProspects.instagramUsername, instagramUsername));
  if (existingProspects.some((prospect) => prospect.status !== "closed")) {
    redirect("/comercial/campanhas?erro=Este+perfil+já+está+em+uma+campanha+ativa");
  }
  let contactPolicy = "manual_only";
  if (lead && !lead.doNotContact) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, lead.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);
    if (conversation && !conversation.externalId?.startsWith("comment:")) {
      const [latestInbound] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversation.id), eq(messages.direction, "inbound")))
        .orderBy(desc(messages.sentAt))
        .limit(1);
      if (latestInbound?.direction === "inbound" && isInstagramReplyWindowOpen(latestInbound.sentAt)) {
        contactPolicy = "inbound_window";
      }
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const inserted = await db.transaction(async (tx) => {
    if (!lead) {
      const leadId = crypto.randomUUID();
      await tx.insert(leads).values({
        id: leadId,
        instagramUsername,
        name: name || null,
        leadType: campaign.funnelType === "partner" ? "partner" : "consumer",
        source: `Outbound · ${campaign.name}`,
        segment: campaign.segment,
        score: profileScore.score,
        icpScore: profileScore.score,
        pipelineStage: "discovered",
        channelState: "browser_contact_pending",
        createdAt: now,
        updatedAt: now,
      });
      [lead] = await tx.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    }
    const created = await tx.insert(outboundProspects).values({
      id,
      campaignId,
      leadId: lead?.id,
      instagramUsername,
      name: name || null,
      sourceUrl: sourceUrl || null,
      profileCategory: profileCategory || null,
      profileBio: profileBio || null,
      profileLocation: profileLocation || null,
      publicSignal: publicSignal || null,
      qualificationReason,
      funnelType: campaign.funnelType,
      pipelineStage: profileScore.score >= 40 ? "qualified" : "discovered",
      icpScore: profileScore.score,
      priority: profileScore.priority,
      contactPolicy,
      status: "identified",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().returning({ id: outboundProspects.id });
    if (!created.length) return false;
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "outbound_prospect_identified",
      entityType: "outbound_prospect",
      entityId: id,
      metadata: JSON.stringify({ campaignId, contactPolicy, icpScore: profileScore.score, matches: profileScore.matches }),
      createdAt: now,
    });
    await tx.insert(outboundEvents).values({
      id: crypto.randomUUID(),
      prospectId: id,
      campaignId,
      leadId: lead?.id,
      type: "prospect_discovered",
      metadata: JSON.stringify({ icpScore: profileScore.score, matches: profileScore.matches }),
      occurredAt: now,
    });
    return true;
  });
  if (!inserted) redirect("/comercial/campanhas?erro=Este+perfil+já+está+na+campanha");
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?prospecto=1");
}

export async function prepareOutboundProspectDraft(formData: FormData) {
  await requireAdminAccess();
  const prospectId = String(formData.get("prospectId") || "");
  const db = await getCommercialDb();
  const [row] = await db
    .select({ prospect: outboundProspects, campaign: campaigns, lead: leads })
    .from(outboundProspects)
    .innerJoin(campaigns, eq(outboundProspects.campaignId, campaigns.id))
    .leftJoin(leads, eq(outboundProspects.leadId, leads.id))
    .where(eq(outboundProspects.id, prospectId))
    .limit(1);
  if (!row) redirect("/comercial/campanhas?erro=Prospecto+não+encontrado");
  if (row.lead?.doNotContact) redirect("/comercial/campanhas?erro=Contato+bloqueado+por+opt-out");

  const business = await getBusinessConfig();
  const [experiment] = await db
    .select()
    .from(experiments)
    .where(eq(experiments.status, "active"))
    .orderBy(desc(experiments.createdAt))
    .limit(1);
  const experimentVariant = experiment
    ? assignExperimentVariant(row.prospect.instagramUsername, experiment.id)
    : null;
  const generated = row.lead
    ? await generateOutboundOpening({
        leadId: row.lead.id,
        firstName: row.prospect.name,
        profileCategory: row.prospect.profileCategory,
        profileBio: row.prospect.profileBio,
        profileLocation: row.prospect.profileLocation,
        publicSignal: row.prospect.publicSignal,
        funnelType: row.prospect.funnelType as OutboundFunnel,
      })
    : {
        message: buildSafeOutboundOpening({
          firstName: row.prospect.name,
          companyName: business.company.name,
          publicSignal: row.prospect.publicSignal,
          funnelType: row.prospect.funnelType as OutboundFunnel,
        }),
        source: "rules" as const,
      };
  const draftBody = generated.message;
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(outboundProspects).set({
      draftBody,
      status: "waiting_review",
      experimentId: experiment?.id || null,
      experimentVariant,
      reviewedAt: null,
      updatedAt: now,
    }).where(eq(outboundProspects.id, prospectId));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "assistant",
      action: "outbound_draft_prepared",
      entityType: "outbound_prospect",
      entityId: prospectId,
      metadata: JSON.stringify({ contactPolicy: row.prospect.contactPolicy, experimentId: experiment?.id || null, experimentVariant, source: generated.source, sent: false }),
      createdAt: now,
    });
    await tx.insert(outboundEvents).values({
      id: crypto.randomUUID(),
      prospectId,
      campaignId: row.campaign.id,
      leadId: row.lead?.id,
      type: "draft_prepared",
      variant: experimentVariant,
      metadata: JSON.stringify({ sent: false }),
      occurredAt: now,
    });
  });
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?rascunho=1");
}

export async function setOutboundCampaignEnabled(formData: FormData) {
  await requireAdminAccess();
  const campaignId = String(formData.get("campaignId") || "");
  const enabled = String(formData.get("enabled") || "false") === "true";
  const settings = await getSystemSettings();
  if (
    enabled &&
    (process.env.OUTBOUND_AUTOMATION_ENABLED !== "true" ||
      process.env.BROWSER_SEND_ENABLED !== "true" ||
      settings.automation_paused === "true" ||
      settings.outbound_paused !== "false")
  ) {
    redirect("/comercial/campanhas?erro=Liberação+global+de+outbound+ainda+está+bloqueada");
  }
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(campaigns).set({
      outboundEnabled: enabled,
      status: enabled ? "active" : "paused",
      updatedAt: now,
    }).where(eq(campaigns.id, campaignId));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: enabled ? "outbound_campaign_enabled" : "outbound_campaign_paused",
      entityType: "campaign",
      entityId: campaignId,
      metadata: JSON.stringify({ enabled }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?campanha=1");
}

export async function saveOutboundProspectDraft(formData: FormData) {
  await requireAdminAccess();
  const prospectId = String(formData.get("prospectId") || "");
  const draftBody = String(formData.get("draftBody") || "").trim();
  if (!prospectId || draftBody.length < 10 || draftBody.length > 1_000) {
    redirect("/comercial/campanhas?erro=Revise+o+rascunho+(10+a+1000+caracteres)");
  }
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(outboundProspects).set({
      draftBody,
      status: "approved_manual",
      reviewedAt: now,
      updatedAt: now,
    }).where(eq(outboundProspects.id, prospectId)).returning({ id: outboundProspects.id });
    if (!rows.length) return false;
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "outbound_draft_approved_manual",
      entityType: "outbound_prospect",
      entityId: prospectId,
      metadata: JSON.stringify({ sent: false }),
      createdAt: now,
    });
    return true;
  });
  if (!updated) redirect("/comercial/campanhas?erro=Prospecto+não+encontrado");
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?revisado=1");
}

export async function queueOutboundFirstContact(formData: FormData) {
  await requireAdminAccess();
  const prospectId = String(formData.get("prospectId") || "");
  const db = await getCommercialDb();
  const [row] = await db
    .select({ prospect: outboundProspects, campaign: campaigns, lead: leads })
    .from(outboundProspects)
    .innerJoin(campaigns, eq(outboundProspects.campaignId, campaigns.id))
    .leftJoin(leads, eq(outboundProspects.leadId, leads.id))
    .where(eq(outboundProspects.id, prospectId))
    .limit(1);
  if (!row || !row.lead || row.prospect.status !== "approved_manual") {
    redirect("/comercial/campanhas?erro=O+rascunho+precisa+de+aprovação+humana");
  }
  const settings = await getSystemSettings();
  if (
    process.env.OUTBOUND_AUTOMATION_ENABLED !== "true" ||
    process.env.BROWSER_SEND_ENABLED !== "true" ||
    settings.automation_paused === "true" ||
    settings.outbound_paused !== "false" ||
    !row.campaign.outboundEnabled
  ) {
    redirect("/comercial/campanhas?erro=As+travas+de+outbound+e+navegador+ainda+estão+fechadas");
  }
  if (row.lead.doNotContact) {
    redirect("/comercial/campanhas?erro=Contato+bloqueado+por+opt-out");
  }
  const [ownedConversation] = await db
    .select({ channelOwner: conversations.channelOwner })
    .from(conversations)
    .where(eq(conversations.leadId, row.lead.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  if (ownedConversation?.channelOwner === "api") {
    redirect("/comercial/campanhas?erro=Este+contato+já+pertence+à+API+oficial");
  }

  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(jobs).values({
      id: jobId,
      type: "send_outbound",
      payload: JSON.stringify({ leadId: row.lead!.id, prospectId }),
      status: "pending",
      maxAttempts: 3,
      scheduledAt: now,
      idempotencyKey: `outbound:first:${prospectId}`,
      createdAt: now,
    });
    await tx
      .update(outboundProspects)
      .set({ status: "queued", browserJobId: jobId, updatedAt: now })
      .where(eq(outboundProspects.id, prospectId));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "outbound_first_contact_queued",
      entityType: "outbound_prospect",
      entityId: prospectId,
      metadata: JSON.stringify({ jobId, sent: false }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/campanhas");
  redirect("/comercial/campanhas?agendado=1");
}

export async function createExperiment(formData: FormData) {
  await requireAdminAccess();
  const hypothesis = String(formData.get("hypothesis") || "").trim();
  const control = String(formData.get("control") || "").trim();
  const variant = String(formData.get("variant") || "").trim();
  const primaryMetric = String(formData.get("primaryMetric") || "").trim();
  const minimumSampleSize = Math.max(
    20,
    Math.min(1_000, Number(formData.get("minimumSampleSize") || 30)),
  );
  if (
    hypothesis.length < 10 ||
    control.length < 3 ||
    variant.length < 3 ||
    primaryMetric.length < 3 ||
    !Number.isFinite(minimumSampleSize)
  ) {
    redirect("/comercial/experimentos?erro=Preencha+todos+os+campos+do+experimento");
  }
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(experiments).values({
      id,
      hypothesis,
      control,
      variant,
      sampleSize: 0,
      minimumSampleSize: Math.trunc(minimumSampleSize),
      primaryMetric,
      secondaryMetrics: "[]",
      status: "draft",
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "experiment_created",
      entityType: "experiment",
      entityId: id,
      metadata: JSON.stringify({ minimumSampleSize: Math.trunc(minimumSampleSize) }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/experimentos");
  redirect("/comercial/experimentos?salvo=1");
}

export async function setExperimentStatus(formData: FormData) {
  await requireAdminAccess();
  const experimentId = String(formData.get("experimentId") || "");
  const status = String(formData.get("status") || "paused");
  if (!experimentId || !["active", "paused"].includes(status)) {
    redirect("/comercial/experimentos?erro=Estado+de+experimento+inválido");
  }
  const db = await getCommercialDb();
  const [experiment] = await db
    .select()
    .from(experiments)
    .where(eq(experiments.id, experimentId))
    .limit(1);
  if (!experiment) redirect("/comercial/experimentos?erro=Experimento+não+encontrado");
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    if (status === "active") {
      await tx
        .update(experiments)
        .set({ status: "paused" })
        .where(eq(experiments.status, "active"));
    }
    await tx
      .update(experiments)
      .set({
        status,
        startedAt: status === "active" ? experiment.startedAt || now : experiment.startedAt,
      })
      .where(eq(experiments.id, experimentId));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: status === "active" ? "experiment_started" : "experiment_paused",
      entityType: "experiment",
      entityId: experimentId,
      metadata: JSON.stringify({ sampleSize: experiment.sampleSize }),
      createdAt: now,
    });
  });
  revalidatePath("/comercial/experimentos");
  redirect("/comercial/experimentos?estado=1");
}

export async function updateLeadStage(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  const pipelineStage = String(formData.get("pipelineStage") || "");
  const allowed = new Set(["discovered", "qualified", "contacted", "replied", "interest_identified", "requirements_collection", "quote_requested", "whatsapp_handoff", "quote_sent", "order_pending", "order_confirmed", ...OUTBOUND_PIPELINES.partner, "closed"]);
  if (!leadId || !allowed.has(pipelineStage)) throw new Error("Etapa inválida.");
  const db = await getCommercialDb();
  const [prospect] = await db
    .select({ funnelType: outboundProspects.funnelType, pipelineStage: outboundProspects.pipelineStage })
    .from(outboundProspects)
    .where(eq(outboundProspects.leadId, leadId))
    .limit(1);
  if (
    prospect &&
    pipelineStage !== prospect.pipelineStage &&
    !isValidOutboundTransition(
      prospect.funnelType as OutboundFunnel,
      prospect.pipelineStage,
      pipelineStage,
    )
  ) {
    throw new Error("Avance uma etapa por vez ou encerre o contato.");
  }
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ pipelineStage, updatedAt: now }).where(eq(leads.id, leadId));
    await tx.update(outboundProspects).set({ pipelineStage, updatedAt: now }).where(eq(outboundProspects.leadId, leadId));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "stage_changed", title: `Etapa alterada para ${pipelineStage}`, createdBy: "operator", createdAt: now });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "pipeline_stage_updated", entityType: "lead", entityId: leadId, metadata: JSON.stringify({ pipelineStage }), createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/funil");
}

export async function blockLeadContact(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) throw new Error("Lead inválido.");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.doNotContact) {
    revalidatePath(`/comercial/leads/${leadId}`);
    return;
  }
  const now = new Date().toISOString();
  const openJobs = await db.select().from(jobs);
  const leadJobIds = openJobs
    .filter((job) => ["pending", "waiting_review"].includes(job.status))
    .filter((job) => {
      try {
        return JSON.parse(job.payload).leadId === leadId;
      } catch {
        return false;
      }
    })
    .map((job) => job.id);
  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({ doNotContact: true, pipelineStage: "closed", channelState: "do_not_contact", nextActionAt: null, updatedAt: now })
      .where(eq(leads.id, leadId));
    await tx
      .update(outboundProspects)
      .set({ status: "closed", pipelineStage: "closed", updatedAt: now })
      .where(eq(outboundProspects.leadId, leadId));
    for (const jobId of leadJobIds) {
      await tx
        .update(jobs)
        .set({ status: "completed", finishedAt: now, lastError: "Cancelado: contato está em do_not_contact" })
        .where(eq(jobs.id, jobId));
    }
    await tx.insert(timelineEvents).values({
      id: crypto.randomUUID(),
      leadId,
      type: "opt_out",
      title: "Contato bloqueado permanentemente pelo operador",
      createdBy: "operator",
      createdAt: now,
    });
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: "operator",
      action: "lead_added_to_do_not_contact",
      entityType: "lead",
      entityId: leadId,
      metadata: "{}",
      createdAt: now,
    });
  });
  revalidatePath("/comercial", "layout");
}

export async function registerQuote(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  const rawAmount = String(formData.get("amount") || "").replace(",", ".");
  const amountCents = Math.round(Number(rawAmount) * 100);
  if (!leadId || !Number.isFinite(amountCents) || amountCents <= 0) throw new Error("Valor de orçamento inválido.");
  const db = await getCommercialDb();
  const now = new Date().toISOString();
  const [existing] = await db.select().from(quoteRequests).where(eq(quoteRequests.leadId, leadId)).limit(1);
  const quoteId = existing?.id || crypto.randomUUID();
  await db.transaction(async (tx) => {
    if (existing) await tx.update(quoteRequests).set({ amountCents, status: "sent", sentAt: now, updatedAt: now }).where(eq(quoteRequests.id, existing.id));
    else await tx.insert(quoteRequests).values({ id: quoteId, leadId, amountCents, status: "sent", sentAt: now, createdAt: now, updatedAt: now });
    await tx.update(leads).set({ quoteStatus: "sent", pipelineStage: "quote_sent", estimatedOrderValueCents: amountCents, updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "quote", title: "Orçamento registrado e enviado", metadata: JSON.stringify({ amountCents }), createdBy: "operator", createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/orcamentos");
}

export async function confirmCommercialOrder(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead?.estimatedOrderValueCents) throw new Error("Registre um orçamento antes de confirmar o pedido.");
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.leadId, leadId)).limit(1);
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.insert(commercialOrders).values({ id: crypto.randomUUID(), leadId, quoteRequestId: quote?.id, source: lead.source, productCategory: lead.segment, amountCents: lead.estimatedOrderValueCents!, status: "confirmed", confirmedAt: now, createdAt: now });
    await tx.update(leads).set({ orderStatus: "confirmed", quoteStatus: "accepted", pipelineStage: "order_confirmed", confirmedOrderValueCents: lead.estimatedOrderValueCents, updatedAt: now }).where(eq(leads.id, leadId));
    if (quote) await tx.update(quoteRequests).set({ status: "accepted", updatedAt: now }).where(eq(quoteRequests.id, quote.id));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "order", title: "Pedido confirmado", metadata: JSON.stringify({ amountCents: lead.estimatedOrderValueCents, source: lead.source }), createdBy: "operator", createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/pedidos");
  revalidatePath("/comercial");
}

export async function registerWhatsappHandoff(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  const [briefing] = await db.select().from(briefings).where(eq(briefings.leadId, leadId)).limit(1);
  const handoff = await prepareWhatsAppHandoff(lead.instagramUsername, briefing || { productInterest: lead.productInterest, occasion: lead.occasion });
  if (!handoff.enabled) redirect("/comercial/configuracoes?erro=Configure+o+WhatsApp+antes+do+handoff");
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ pipelineStage: "whatsapp_handoff", channelState: "whatsapp_handoff", whatsappHandoffAt: now, updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "whatsapp_handoff", title: "Encaminhado ao WhatsApp", description: "Briefing anexado ao handoff para evitar perguntas repetidas.", createdBy: "operator", createdAt: now });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "whatsapp_handoff_created", entityType: "lead", entityId: leadId, metadata: JSON.stringify({ summaryLength: handoff.summary.length }), createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  redirect(handoff.url);
}

export async function createInstagramReplyDraft(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) throw new Error("Lead inválido.");
  const result = await createReplyDraftForLead(leadId);
  revalidatePath(`/comercial/leads/${leadId}`);
  if (result.status === "blocked") {
    redirect(`/comercial/leads/${leadId}?erro=Contato+bloqueado+por+opt-out`);
  }
  if (result.status === "not_found") {
    redirect(`/comercial/leads/${leadId}?erro=Não+há+mensagem+recebida+para+responder`);
  }
  if (result.status === "already_replied") {
    redirect(`/comercial/leads/${leadId}?erro=A+última+mensagem+já+foi+respondida`);
  }
  redirect(`/comercial/leads/${leadId}?rascunho=1`);
}

export async function approveInstagramReply(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  const messageId = String(formData.get("messageId") || "");
  const body = String(formData.get("body") || "");
  if (!leadId || !messageId) throw new Error("Resposta inválida.");

  const result = await approveAndSendInstagramReply({ leadId, messageId, body });
  revalidatePath(`/comercial/leads/${leadId}`);
  const errors: Record<string, string> = {
    invalid_text: "Revise+o+texto+da+mensagem",
    not_found: "Rascunho+ou+conversa+não+encontrado",
    blocked: "Contato+bloqueado+por+opt-out",
    invalid_recipient: "Esta+é+uma+conversa+simulada+e+não+pode+ser+enviada",
    comment_review_only: "Comentários+ficam+somente+em+revisão+e+não+são+enviados+como+DM",
    outside_window: "A+janela+de+24+horas+para+resposta+foi+encerrada",
    already_processed: "Esta+resposta+já+foi+processada",
    failed: "O+Instagram+recusou+o+envio;+revise+a+integração+e+tente+novamente",
    send_uncertain: "Envio+incerto;+confira+o+Instagram+antes+de+qualquer+nova+tentativa",
  };
  if (result.status !== "sent") {
    redirect(`/comercial/leads/${leadId}?erro=${errors[result.status] || "Falha+no+envio"}`);
  }
  redirect(`/comercial/leads/${leadId}?enviado=1`);
}

export async function escalateInstagramConversation(formData: FormData) {
  await requireAdminAccess();
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) throw new Error("Lead inválido.");
  const db = await getCommercialDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ channelState: "human_review_required", updatedAt: now }).where(eq(leads.id, leadId));
    await tx.insert(exceptions).values({ id: crypto.randomUUID(), leadId, type: "human_review", severity: "medium", title: "Conversa encaminhada para atendimento humano", description: "Encaminhamento manual registrado pelo operador.", status: "open", createdAt: now });
    await tx.insert(timelineEvents).values({ id: crypto.randomUUID(), leadId, type: "human_review", title: "Conversa encaminhada para atendimento humano", createdBy: "operator", createdAt: now });
    await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actor: "operator", action: "instagram_conversation_escalated", entityType: "lead", entityId: leadId, createdAt: now });
  });
  revalidatePath(`/comercial/leads/${leadId}`);
  revalidatePath("/comercial/excecoes");
  redirect(`/comercial/leads/${leadId}?escalado=1`);
}

export async function runInstagramReliabilityCheck() {
  await requireAdminAccess();
  const result = await runInstagramMaintenance();
  revalidatePath("/comercial/configuracoes");
  revalidatePath("/comercial/conversas");
  if (result.status === "error") {
    redirect(`/comercial/configuracoes?erro=${encodeURIComponent(result.error)}`);
  }
  if (result.status === "locked") {
    redirect("/comercial/configuracoes?erro=Uma+verificação+já+está+em+andamento");
  }
  redirect(`/comercial/configuracoes?verificado=${result.status}`);
}
