import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { systemSettings } from "../../db/schema";
import { getCommercialDb } from "../db/commercial";

const businessSchema = z.object({
  owner: z.object({ name: z.string(), role: z.string() }),
  company: z.object({
    name: z.string(),
    website: z.string(),
    instagramHandle: z.string(),
    whatsappLink: z.string(),
  }),
  brand: z.object({
    tagline: z.string(),
    voice: z.string(),
    oneLinePitch: z.string(),
  }),
  howItWorks: z.array(z.string()),
  revenueModel: z.string(),
  primaryProducts: z.array(z.string()),
  customizationOptions: z.array(z.string()),
  marketJargon: z.record(z.string(), z.string()),
  verifiedClaims: z.array(z.string()),
  unverifiedClaims: z.array(z.string()),
  icpSegments: z.array(z.string()),
  icpKeywords: z.array(z.string()),
  partnershipSegments: z.array(z.string()),
  partnershipsEnabled: z.boolean(),
  partnershipLink: z.string(),
  targetGeography: z.string(),
  fulfillmentGeography: z.string(),
  defaultCurrency: z.string(),
  defaultTimezone: z.string(),
});

export type BusinessConfig = z.infer<typeof businessSchema>;

let cachedBusiness: BusinessConfig | undefined;
const BUSINESS_CONFIG_KEY = "business_config";

function getEnvironmentBusinessConfig() {
  const raw = process.env.BUSINESS_CONFIG_JSON?.trim();
  if (!raw) return undefined;
  return businessSchema.parse(JSON.parse(raw));
}

function hasPlaceholderIdentity(config: BusinessConfig) {
  return (
    config.company.name.startsWith("NOME_") ||
    config.owner.name.startsWith("NOME_")
  );
}

function getFileBusinessConfig(): BusinessConfig {
  if (cachedBusiness) return cachedBusiness;

  const realPath = path.join(process.cwd(), "config", "business.json");
  const examplePath = path.join(
    process.cwd(),
    "config",
    "business.example.json",
  );

  try {
    cachedBusiness = businessSchema.parse(
      JSON.parse(readFileSync(realPath, "utf8")),
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) throw error;
    cachedBusiness = businessSchema.parse(
      JSON.parse(readFileSync(examplePath, "utf8")),
    );
  }

  return cachedBusiness;
}

export async function getBusinessConfig(): Promise<BusinessConfig> {
  const bootstrap = getEnvironmentBusinessConfig() || getFileBusinessConfig();
  const db = await getCommercialDb();
  const [stored] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, BUSINESS_CONFIG_KEY))
    .limit(1);
  if (stored) {
    const parsed = businessSchema.parse(JSON.parse(stored.value));
    if (!hasPlaceholderIdentity(parsed) || hasPlaceholderIdentity(bootstrap)) {
      return parsed;
    }
    const now = new Date().toISOString();
    await db
      .update(systemSettings)
      .set({ value: JSON.stringify(bootstrap), updatedAt: now })
      .where(eq(systemSettings.key, BUSINESS_CONFIG_KEY));
    return bootstrap;
  }

  await db
    .insert(systemSettings)
    .values({
      key: BUSINESS_CONFIG_KEY,
      value: JSON.stringify(bootstrap),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  return bootstrap;
}

export function isDefinedBusinessValue(value: string | undefined | null) {
  return Boolean(value && value !== "A_DEFINIR" && value !== "N/A");
}

export async function saveBusinessFields(fields: {
  whatsappLink?: string;
  fulfillmentGeography?: string;
}) {
  const current = await getBusinessConfig();
  const next = businessSchema.parse({
    ...current,
    company: {
      ...current.company,
      whatsappLink: fields.whatsappLink ?? current.company.whatsappLink,
    },
    fulfillmentGeography:
      fields.fulfillmentGeography ?? current.fulfillmentGeography,
  });
  const now = new Date().toISOString();
  const db = await getCommercialDb();
  await db
    .insert(systemSettings)
    .values({ key: BUSINESS_CONFIG_KEY, value: JSON.stringify(next), updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: JSON.stringify(next), updatedAt: now },
    });
  if ((process.env.COMMERCIAL_DATABASE_MODE?.trim() || "local") === "local") {
    writeFileSync(
      path.join(process.cwd(), "config", "business.json"),
      `${JSON.stringify(next, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
  cachedBusiness = next;
  return next;
}
