import "server-only";

const productionOrigin = "https://notify.mibess.com.br";
const homologationOrigin = "https://notify-hml.mibess.com.br";

export const notifyEnabled = () => process.env.MIBESS_NOTIFY_ENABLED === "true";

// Bind each snapshot to its environment even when a key/URL is missing or rotated.
// Preview deployments can never send to production, even with copied variables.
export function notifyTargetOrigin() {
  let productionStore = false;
  try {
    const url = new URL(process.env.APP_URL || "");
    productionStore = url.protocol === "https:" && ["artgian.com.br", "www.artgian.com.br"].includes(url.hostname);
  } catch { /* Unknown/local origins are always homologation. */ }
  return productionStore && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production")
    ? productionOrigin : homologationOrigin;
}

export function notifyPublisherConfig() {
  const targetOrigin = notifyTargetOrigin();
  try {
    const url = new URL(process.env.MIBESS_NOTIFY_BASE_URL?.trim() || "");
    if (url.origin !== targetOrigin || url.pathname.replace(/\/+$/, "") || url.search || url.hash || url.username || url.password) return null;
    const apiKey = process.env.MIBESS_NOTIFY_API_KEY?.trim();
    if (!apiKey || /[\r\n]/.test(apiKey)) return null;
    return { targetOrigin, apiKey };
  } catch { return null; }
}
