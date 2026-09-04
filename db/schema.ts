import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("pending"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerDocument: text("customer_document"),
    postalCode: text("postal_code").notNull(),
    streetAddress: text("street_address").notNull(),
    addressNumber: text("address_number").notNull(),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    shippingProvider: text("shipping_provider"),
    shippingServiceId: text("shipping_service_id"),
    shippingServiceName: text("shipping_service_name"),
    shippingCompanyId: text("shipping_company_id"),
    shippingCompanyName: text("shipping_company_name"),
    shippingDeliveryTimeDays: integer("shipping_delivery_time_days"),
    shippingQuotedAt: text("shipping_quoted_at"),
    shippingLabelId: text("shipping_label_id"),
    shippingLabelStatus: text("shipping_label_status"),
    shippingLabelUrl: text("shipping_label_url"),
    shippingTrackingCode: text("shipping_tracking_code"),
    shippingLabelError: text("shipping_label_error"),
    shippingLabelUpdatedAt: text("shipping_label_updated_at"),
    totalCents: integer("total_cents").notNull(),
    mercadoPagoPreferenceId: text("mercado_pago_preference_id"),
    mercadoPagoPaymentId: text("mercado_pago_payment_id"),
    mercadoPagoStatus: text("mercado_pago_status"),
    mercadoPagoStatusDetail: text("mercado_pago_status_detail"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("orders_status_idx").on(table.status),
    index("orders_payment_id_idx").on(table.mercadoPagoPaymentId),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    color: text("color").notNull(),
    personalization: text("personalization"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)],
);

export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventKey: text("event_key").notNull(),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    paymentId: text("payment_id").notNull(),
    action: text("action"),
    payload: text("payload").notNull(),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("payment_events_event_key_unique").on(table.eventKey),
    index("payment_events_order_id_idx").on(table.orderId),
  ],
);

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    instagramUsername: text("instagram_username").notNull(),
    name: text("name"),
    leadType: text("lead_type").notNull().default("consumer"),
    source: text("source").notNull(),
    segment: text("segment"),
    productInterest: text("product_interest"),
    occasion: text("occasion"),
    tags: text("tags").notNull().default("[]"),
    score: integer("score").notNull().default(0),
    intentScore: integer("intent_score").notNull().default(0),
    icpScore: integer("icp_score").notNull().default(0),
    engagementScore: integer("engagement_score").notNull().default(0),
    commercialPotentialScore: integer("commercial_potential_score").notNull().default(0),
    urgencyScore: integer("urgency_score").notNull().default(0),
    pipelineStage: text("pipeline_stage").notNull().default("discovered"),
    channelState: text("channel_state").notNull().default("waiting_inbound_reply"),
    lastContactAt: text("last_contact_at"),
    nextActionAt: text("next_action_at"),
    whatsappHandoffAt: text("whatsapp_handoff_at"),
    quoteStatus: text("quote_status").notNull().default("none"),
    orderStatus: text("order_status").notNull().default("none"),
    estimatedOrderValueCents: integer("estimated_order_value_cents"),
    confirmedOrderValueCents: integer("confirmed_order_value_cents"),
    doNotContact: integer("do_not_contact", { mode: "boolean" }).notNull().default(false),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("leads_instagram_username_unique").on(table.instagramUsername),
    index("idx_leads_pipeline_stage").on(table.pipelineStage),
    index("idx_leads_next_action_at").on(table.nextActionAt),
    index("idx_leads_source").on(table.source),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("instagram"),
    externalId: text("external_id"),
    channelOwner: text("channel_owner").notNull().default("api"),
    handedOffAt: text("handed_off_at"),
    lastInboundAt: text("last_inbound_at"),
    status: text("status").notNull().default("active"),
    lastMessageAt: text("last_message_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("conversations_channel_external_id_unique").on(table.channel, table.externalId),
    index("idx_conversations_lead_id").on(table.leadId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    direction: text("direction").notNull(),
    sender: text("sender").notNull(),
    body: text("body").notNull(),
    intent: text("intent"),
    action: text("action"),
    status: text("status").notNull().default("received"),
    sentAt: text("sent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("messages_external_id_unique").on(table.externalId),
    index("idx_messages_conversation_sent_at").on(table.conversationId, table.sentAt),
  ],
);

export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    metadata: text("metadata").notNull().default("{}"),
    createdBy: text("created_by").notNull().default("system"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_timeline_events_lead_created").on(table.leadId, table.createdAt)],
);

export const briefings = sqliteTable(
  "briefings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    productInterest: text("product_interest"),
    productCategory: text("product_category"),
    occasion: text("occasion"),
    recipient: text("recipient"),
    referenceDescription: text("reference_description"),
    referenceUrl: text("reference_url"),
    customizationText: text("customization_text"),
    preferredColors: text("preferred_colors"),
    preferredSize: text("preferred_size"),
    quantity: integer("quantity"),
    desiredDeadline: text("desired_deadline"),
    city: text("city"),
    state: text("state"),
    shippingRequired: integer("shipping_required", { mode: "boolean" }),
    budgetRange: text("budget_range"),
    additionalNotes: text("additional_notes"),
    needsQuote: integer("needs_quote", { mode: "boolean" }).notNull().default(true),
    needsProductionReview: integer("needs_production_review", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("collecting"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("briefings_lead_id_unique").on(table.leadId)],
);

export const catalogProducts = sqliteTable(
  "catalog_products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    images: text("images").notNull().default("[]"),
    basePriceCents: integer("base_price_cents"),
    priceFromCents: integer("price_from_cents"),
    pricingType: text("pricing_type").notNull().default("quote"),
    materials: text("materials").notNull().default("[]"),
    availableColors: text("available_colors").notNull().default("[]"),
    availableSizes: text("available_sizes").notNull().default("[]"),
    customizationOptions: text("customization_options").notNull().default("[]"),
    productionTime: text("production_time"),
    minimumQuantity: integer("minimum_quantity"),
    maximumQuantity: integer("maximum_quantity"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    verifiedClaims: text("verified_claims").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("catalog_products_name_unique").on(table.name)],
);

export const quoteRequests = sqliteTable(
  "quote_requests",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    briefingId: text("briefing_id").references(() => briefings.id, { onDelete: "set null" }),
    status: text("status").notNull().default("requested"),
    amountCents: integer("amount_cents"),
    validUntil: text("valid_until"),
    notes: text("notes"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_quote_requests_lead_id").on(table.leadId)],
);

export const commercialOrders = sqliteTable(
  "commercial_orders",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "restrict" }),
    quoteRequestId: text("quote_request_id").references(() => quoteRequests.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    productCategory: text("product_category"),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("confirmed"),
    confirmedAt: text("confirmed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_commercial_orders_lead_id").on(table.leadId)],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: text("payload").notNull().default("{}"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    scheduledAt: text("scheduled_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("jobs_idempotency_key_unique").on(table.idempotencyKey),
    index("idx_jobs_status_scheduled").on(table.status, table.scheduledAt),
  ],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsdMicros: integer("estimated_cost_usd_micros").notNull().default(0),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    purpose: text("purpose").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_ai_usage_created_at").on(table.createdAt)],
);

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull(),
  segment: text("segment"),
  funnelType: text("funnel_type").notNull().default("consumer"),
  dailyLimit: integer("daily_limit").notNull().default(5),
  operatingHours: text("operating_hours").notNull().default("09:00-18:00"),
  operatingTimezone: text("operating_timezone").notNull().default("America/Sao_Paulo"),
  status: text("status").notNull().default("draft"),
  outboundEnabled: integer("outbound_enabled", { mode: "boolean" }).notNull().default(false),
  discoveryEnabled: integer("discovery_enabled", { mode: "boolean" }).notNull().default(false),
  discoveryKeywords: text("discovery_keywords").notNull().default("[]"),
  discoveryHashtags: text("discovery_hashtags").notNull().default("[]"),
  discoveryLocations: text("discovery_locations").notNull().default("[]"),
  discoveryDailyLimit: integer("discovery_daily_limit").notNull().default(10),
  discoveryMinimumScore: integer("discovery_minimum_score").notNull().default(40),
  discoveryIntervalHours: integer("discovery_interval_hours").notNull().default(24),
  lastDiscoveryAt: text("last_discovery_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const outboundProspects = sqliteTable(
  "outbound_prospects",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    instagramUsername: text("instagram_username").notNull(),
    name: text("name"),
    sourceUrl: text("source_url"),
    profileCategory: text("profile_category"),
    profileBio: text("profile_bio"),
    profileLocation: text("profile_location"),
    publicSignal: text("public_signal"),
    discoverySource: text("discovery_source").notNull().default("manual"),
    discoveryQuery: text("discovery_query"),
    qualificationReason: text("qualification_reason").notNull(),
    funnelType: text("funnel_type").notNull().default("consumer"),
    pipelineStage: text("pipeline_stage").notNull().default("discovered"),
    icpScore: integer("icp_score").notNull().default(0),
    priority: text("priority").notNull().default("normal"),
    contactPolicy: text("contact_policy").notNull().default("manual_only"),
    status: text("status").notNull().default("identified"),
    draftBody: text("draft_body"),
    experimentId: text("experiment_id"),
    experimentVariant: text("experiment_variant"),
    browserJobId: text("browser_job_id"),
    lastError: text("last_error"),
    lastAttemptAt: text("last_attempt_at"),
    reviewedAt: text("reviewed_at"),
    contactedAt: text("contacted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("outbound_prospects_username_unique").on(
      table.instagramUsername,
    ),
    uniqueIndex("outbound_prospects_campaign_username_unique").on(
      table.campaignId,
      table.instagramUsername,
    ),
    index("outbound_prospects_status_idx").on(table.status),
    index("outbound_prospects_lead_idx").on(table.leadId),
  ],
);

export const discoveryRuns = sqliteTable(
  "discovery_runs",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    status: text("status").notNull().default("running"),
    queriesScanned: integer("queries_scanned").notNull().default(0),
    profilesInspected: integer("profiles_inspected").notNull().default(0),
    profilesQualified: integer("profiles_qualified").notNull().default(0),
    profilesCreated: integer("profiles_created").notNull().default(0),
    skippedDuplicates: integer("skipped_duplicates").notNull().default(0),
    skippedBlocked: integer("skipped_blocked").notNull().default(0),
    skippedLowScore: integer("skipped_low_score").notNull().default(0),
    error: text("error"),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    finishedAt: text("finished_at"),
  },
  (table) => [
    index("discovery_runs_campaign_idx").on(table.campaignId, table.startedAt),
    index("discovery_runs_status_idx").on(table.status),
  ],
);

export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  hypothesis: text("hypothesis").notNull(),
  variant: text("variant").notNull(),
  control: text("control").notNull(),
  sampleSize: integer("sample_size").notNull().default(0),
  minimumSampleSize: integer("minimum_sample_size").notNull().default(30),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  primaryMetric: text("primary_metric").notNull(),
  secondaryMetrics: text("secondary_metrics").notNull().default("[]"),
  result: text("result"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const outboundEvents = sqliteTable(
  "outbound_events",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id")
      .notNull()
      .references(() => outboundProspects.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    variant: text("variant"),
    metadata: text("metadata").notNull().default("{}"),
    occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("outbound_events_prospect_idx").on(table.prospectId, table.occurredAt),
    index("outbound_events_campaign_idx").on(table.campaignId, table.occurredAt),
    index("outbound_events_type_idx").on(table.type),
  ],
);

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exceptions = sqliteTable(
  "exceptions",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("medium"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("idx_exceptions_status").on(table.status)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_audit_logs_entity").on(table.entityType, table.entityId)],
);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  response: text("response"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const integrationStates = sqliteTable("integration_states", {
  key: text("key").primaryKey(),
  status: text("status").notNull().default("unknown"),
  encryptedAccessToken: text("encrypted_access_token"),
  tokenExpiresAt: text("token_expires_at"),
  lastTokenRefreshAt: text("last_token_refresh_at"),
  lastHealthCheckAt: text("last_health_check_at"),
  lastSuccessfulSyncAt: text("last_successful_sync_at"),
  lastRunStartedAt: text("last_run_started_at"),
  lockUntil: text("lock_until"),
  lastError: text("last_error"),
  metadata: text("metadata").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
