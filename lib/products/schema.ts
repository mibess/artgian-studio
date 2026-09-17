import { z } from "zod";
const imageUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || /^\/(?!\/)[^\\]*$/.test(v) || /^https:\/\//.test(v),
    "Use um caminho de imagem da loja ou uma URL HTTPS.",
  );
const cents = z.number().int().min(0).max(100_000_000);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal.");
export const presentationSchema = z.object({
  template: z.enum([
    "standard",
    "kit-dia-dos-pais",
    "bandeja-aurora",
    "organizador-arco",
    "porta-palhetas-solo",
    "porta-incenso-samurai",
    "suporte-pocket",
  ]),
  accent: color,
  background: color,
  copy: z.record(
    z.string().regex(/^text\d+$/),
    z.object({ label: z.string().max(100), value: z.string().max(3000) }),
  ),
  media: z.array(z.object({ src: imageUrl, alt: z.string().max(500) })).max(30),
  features: z.array(z.array(z.string().max(2000)).length(3)).max(20),
  specifications: z.array(z.array(z.string().max(500)).length(2)).max(30),
  contactUrl: z
    .string()
    .max(2000)
    .refine((v) => !v || /^https:\/\//.test(v), "Use um link HTTPS."),
  sections: z
    .array(
      z.object({
        title: z.string().max(200),
        text: z.string().max(5000),
        image: imageUrl,
      }),
    )
    .max(20),
});
export const storefrontSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    listed: z.boolean(),
    featured: z.boolean(),
    purchasable: z.boolean(),
    variants: z
      .array(
        z.object({
          key: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .max(40),
          name: z.string().min(1).max(80),
          swatches: z.array(color).min(1).max(2),
          image: imageUrl,
          priceCents: cents.nullable(),
        }),
      )
      .max(30),
    shippingPackage: z
      .object({
        widthCm: z.number().positive().max(300),
        heightCm: z.number().positive().max(300),
        lengthCm: z.number().positive().max(300),
        weightKg: z.number().positive().max(100),
      })
      .nullable(),
    personalization: z.object({
      enabled: z.boolean(),
      required: z.boolean(),
      maxLength: z.number().int().min(1).max(200),
      label: z.string().min(1).max(100),
    }),
    presentation: presentationSchema,
    seoTitle: z.string().max(200),
    seoDescription: z.string().max(500),
  })
  .superRefine((v, c) => {
    if (new Set(v.variants.map((x) => x.key)).size !== v.variants.length)
      c.addIssue({
        code: "custom",
        message: "Cada variante precisa de um identificador único.",
      });
    if (v.purchasable && !v.variants.length)
      c.addIssue({
        code: "custom",
        message: "Cadastre pelo menos uma variante para vender na loja.",
      });
    if (v.personalization.required && !v.personalization.enabled)
      c.addIssue({
        code: "custom",
        message: "Ative a personalização antes de torná-la obrigatória.",
      });
  });
export const productInputSchema = z
  .object({
    id: z.string().max(100).optional(),
    version: z.number().int().min(0),
    name: z.string().trim().min(2).max(200),
    category: z.string().max(100),
    description: z.string().max(5000),
    active: z.boolean(),
    pricingType: z.enum(["fixed", "from", "quote"]),
    basePriceCents: cents.nullable(),
    priceFromCents: cents.nullable(),
    productionTime: z.string().max(500),
    minimumQuantity: z.number().int().min(1).max(9),
    maximumQuantity: z.number().int().min(1).max(9),
    availableColors: z.array(z.string().max(100)).max(30).default([]),
    availableSizes: z.array(z.string().max(100)).max(30).default([]),
    customizationOptions: z.array(z.string().max(500)).max(30).default([]),
    aliases: z.array(z.string().trim().min(1).max(200)).max(30),
    materials: z.array(z.string().max(200)).max(30),
    verifiedClaims: z.array(z.string().max(1000)).max(40),
    notes: z.string().max(5000),
    storefront: storefrontSchema.nullable(),
  })
  .superRefine((v, c) => {
    if (v.minimumQuantity > v.maximumQuantity)
      c.addIssue({
        code: "custom",
        message: "A quantidade mínima deve ser menor ou igual à máxima.",
      });
    if (v.pricingType === "fixed" && v.basePriceCents === null)
      c.addIssue({ code: "custom", message: "Informe o preço fixo." });
    if (v.pricingType === "from" && v.priceFromCents === null)
      c.addIssue({ code: "custom", message: "Informe o preço inicial." });
    if (v.storefront?.purchasable && v.pricingType !== "fixed")
      c.addIssue({
        code: "custom",
        message:
          "Compra direta exige preço fixo; desative a compra direta para produtos sob orçamento.",
      });
    if (v.storefront?.listed && !v.storefront.presentation.media[0]?.src)
      c.addIssue({
        code: "custom",
        message: "Cadastre uma imagem principal para publicar na vitrine.",
      });
  });
export type ProductInput = z.infer<typeof productInputSchema>;
