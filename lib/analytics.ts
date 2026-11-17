import type { Product, ProductCatalog } from "./catalog";

export const ANALYTICS_CONSENT_KEY = "artgian:analytics-consent:v1";
export const ANALYTICS_CONSENT_EVENT = "artgian:analytics-consent-change";
export const GA_MEASUREMENT_ID = /^G-[A-Z0-9]+$/.test(
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
)
  ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!
  : "";

type Consent = "accepted" | "rejected";
type AnalyticsEvent = "page_view" | "view_item" | "add_to_cart" | "contact_click";
type EventParameters = Record<string, unknown>;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean;
  }
}

const PUBLIC_PAGES: Record<string, string> = {
  "/": "Artgian Studio",
  "/produtos": "Produtos | Artgian Studio",
  "/carrinho": "Carrinho | Artgian Studio",
  "/politica-de-privacidade": "Política de Privacidade | Artgian Studio",
  "/exclusao-de-dados": "Exclusão de dados | Artgian Studio",
};
let catalog: ProductCatalog = {};
let initialized = false;
let memoryConsent: Consent | null = null;
let previousPage = "";
let lastPage = "";

/** Only known public routes are measured; unknown/private routes fail closed. */
export function analyticsPage(pathname: string, products: ProductCatalog) {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (Object.hasOwn(PUBLIC_PAGES, path)) {
    return { path, title: PUBLIC_PAGES[path], product: undefined };
  }
  const product = Object.values(products).find((item) => item.active && item.href === path);
  return product ? { path, title: `${product.name} | Artgian Studio`, product } : null;
}

export function readAnalyticsConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return memoryConsent;
  }
}

export function saveAnalyticsConsent(consent: Consent) {
  memoryConsent = consent;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // The choice still applies to this visit when browser storage is unavailable.
  }
  if (consent === "rejected") disableAnalytics();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

export function subscribeAnalyticsConsent(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ANALYTICS_CONSENT_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(ANALYTICS_CONSENT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, callback);
  };
}

export function disableAnalytics() {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  lastPage = "";
  // Remove Analytics cookies both at the host and parent domain scopes.
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => `; domain=.${parts.slice(i).join(".")}`)];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.trim().split("=", 1)[0];
    if (name === "_ga" || name.startsWith("_ga_")) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
      }
    }
  }
}

function canMeasure() {
  return Boolean(
    GA_MEASUREMENT_ID &&
      typeof window !== "undefined" &&
      readAnalyticsConsent() === "accepted" &&
      analyticsPage(window.location.pathname, catalog),
  );
}

/** Never copy URLs, form text, customization, contact details or order IDs. */
export function analyticsItem(product: Product, quantity = 1, variantKey?: string) {
  const variant = product.variants.find((item) => item.key === variantKey);
  const priceCents = variant?.priceCents ?? product.basePriceCents;
  return {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category,
    ...(variant ? { item_variant: variant.key } : {}),
    ...(priceCents !== null ? { price: priceCents / 100 } : {}),
    quantity,
  };
}

function sendEvent(name: AnalyticsEvent, parameters: EventParameters = {}) {
  if (!canMeasure() || !window.gtag || !initialized) return;
  const page = analyticsPage(window.location.pathname, catalog)!;
  window.gtag("event", name, {
    ...parameters,
    send_to: GA_MEASUREMENT_ID,
    page_location: `${window.location.origin}${page.path}`,
    page_title: page.title,
    page_referrer: previousPage,
  });
}

export function trackAddToCart(product: Product, quantity: number, variantKey: string) {
  const item = analyticsItem(product, quantity, variantKey);
  sendEvent("add_to_cart", {
    currency: "BRL",
    ...(item.price !== undefined ? { value: item.price * quantity } : {}),
    items: [item],
  });
}

export function contactChannel(href: string): "whatsapp" | "email" | "phone" | "instagram" | null {
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:") return "email";
    if (url.protocol === "tel:") return "phone";
    if (url.protocol !== "https:") return null;
    if (["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname)) return "whatsapp";
    if (["instagram.com", "www.instagram.com"].includes(url.hostname)) return "instagram";
  } catch {
    // Unrecognized or relative destinations are not contact events.
  }
  return null;
}

export function trackContactClick(href: string) {
  const channel = contactChannel(href);
  if (channel) sendEvent("contact_click", { contact_channel: channel });
}

/** Queue configuration before next/script loads the library. Enhanced Measurement
 * must also be disabled in the GA4 stream: all allowed events are explicit here. */
export function syncAnalyticsPage(products: ProductCatalog) {
  catalog = products;
  if (!canMeasure()) {
    if (typeof window !== "undefined" && GA_MEASUREMENT_ID) {
      window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
    }
    lastPage = "";
    return;
  }
  const page = analyticsPage(window.location.pathname, catalog)!;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  if (!initialized) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      // Google's command queue expects the canonical Arguments object.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("js", new Date());
    try {
      previousPage = document.referrer ? new URL(document.referrer).origin : "";
    } catch {
      previousPage = "";
    }
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 60 * 60 * 24 * 180,
      page_location: `${window.location.origin}${page.path}`,
      page_referrer: previousPage,
      page_title: page.title,
    });
    initialized = true;
  }
  if (lastPage === page.path) return;
  // Global values also keep library-generated engagement metadata free of queries.
  window.gtag!("set", {
    page_location: `${window.location.origin}${page.path}`,
    page_referrer: previousPage,
    page_title: page.title,
  });
  sendEvent("page_view");
  if (page.product) {
    const item = analyticsItem(page.product);
    sendEvent("view_item", {
      currency: "BRL",
      ...(item.price !== undefined ? { value: item.price } : {}),
      items: [item],
    });
  }
  previousPage = `${window.location.origin}${page.path}`;
  lastPage = page.path;
}
