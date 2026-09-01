import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

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

export function getBusinessConfig(): BusinessConfig {
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

export function isDefinedBusinessValue(value: string | undefined | null) {
  return Boolean(value && value !== "A_DEFINIR" && value !== "N/A");
}

export function saveBusinessFields(fields: {
  whatsappLink?: string;
  fulfillmentGeography?: string;
}) {
  const current = getBusinessConfig();
  const next = businessSchema.parse({
    ...current,
    company: {
      ...current.company,
      whatsappLink: fields.whatsappLink ?? current.company.whatsappLink,
    },
    fulfillmentGeography:
      fields.fulfillmentGeography ?? current.fulfillmentGeography,
  });
  writeFileSync(
    path.join(process.cwd(), "config", "business.json"),
    `${JSON.stringify(next, null, 2)}\n`,
    { mode: 0o600 },
  );
  cachedBusiness = next;
  return next;
}
