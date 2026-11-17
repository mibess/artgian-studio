import "server-only";
import { z } from "zod";
import type { orders } from "../../db/schema";
import { SITE_URL } from "../site-url";
import { notifyCustomerEnabled } from "./config";

type Order = typeof orders.$inferSelect;
export type NotifyRecipient = {
  externalId: string;
  name: string;
  phone?: string;
  email?: string;
  whatsappOptIn: boolean;
  whatsappOptInAt?: string;
  whatsappOptInSource?: string;
};

function phoneE164(value: string) {
  const normalized = value.trim().replace(/[()\s-]/g, "");
  if (/^[1-9]\d{9,10}$/.test(normalized)) return `+55${normalized}`;
  return /^\+55[1-9]\d{9,10}$/.test(normalized) ? normalized : undefined;
}

// Invalid optional channel data only excludes that channel. It must never make
// payment approval fail or remove the operational notification from the event.
export function customerNotification(order: Order): { recipient?: NotifyRecipient; data: Record<string, string> } {
  if (!notifyCustomerEnabled()) return { data: {} };
  const phone = phoneE164(order.customerPhone);
  const candidate = order.customerEmail.trim().toLowerCase();
  const email = candidate.length <= 254 && z.email().safeParse(candidate).success ? candidate : undefined;
  const data = { orderUrl: `${SITE_URL}/conta/pedidos/${encodeURIComponent(order.id)}` };
  if (!phone && !email) return { data };
  const consentAt = order.whatsappOptInAt;
  const consentSource = order.whatsappOptInSource;
  const whatsappOptIn = Boolean(phone && order.whatsappOptIn && consentAt && z.iso.datetime({ offset: true }).safeParse(consentAt).success && consentSource === "artgian_checkout_v1");
  return {
    data,
    recipient: {
      externalId: order.userId ? `artgian:customer:${order.userId}` : `artgian:order:${order.id}`,
      name: order.customerName,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      whatsappOptIn,
      ...(whatsappOptIn ? { whatsappOptInAt: consentAt!, whatsappOptInSource: consentSource! } : {}),
    },
  };
}
