import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalog } from "./fixtures/catalog";

const product = catalog["porta-palhetas-solo"];
let analytics: typeof import("../lib/analytics");
let storage: Map<string, string>;
let browser: Window;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123456");
  storage = new Map();
  browser = {
    location: { origin: "https://artgian.com.br", hostname: "artgian.com.br", pathname: "/" },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    dispatchEvent: vi.fn(),
  } as unknown as Window;
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", { referrer: "https://google.com/search?q=private-search", cookie: "" });
  analytics = await import("../lib/analytics");
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function commands() {
  return (browser.dataLayer || []).map((entry) => Array.from(entry as IArguments));
}

function events() {
  return commands().filter((args) => args[0] === "event");
}

describe("store analytics privacy and measurement", () => {
  it.each(["/admin", "/admin/leads/private-id", "/login", "/conta/pedidos/private-id", "/comprar", "/comprar/pagamento", "/api/auth", "/unknown/person@example.com"])("excludes private and unknown route %s", (path) => {
    expect(analytics.analyticsPage(path, catalog)).toBeNull();
  });

  it("does not initialize or send anything before opt-in or after refusal", () => {
    analytics.syncAnalyticsPage(catalog);
    expect(browser.gtag).toBeUndefined();
    analytics.saveAnalyticsConsent("rejected");
    analytics.syncAnalyticsPage(catalog);
    analytics.trackAddToCart(product, 1, product.variants[0].key);
    analytics.trackContactClick("https://wa.me/5516997432741?text=private-message");
    expect(browser.dataLayer).toBeUndefined();
  });

  it("strips query strings and fragments and never sends the referrer's search", () => {
    expect(analytics.analyticsPage("/?email=private@example.com#private-name", catalog)?.path).toBe("/");
    analytics.saveAnalyticsConsent("accepted");
    analytics.syncAnalyticsPage(catalog);
    expect(events()).toEqual([["event", "page_view", {
      send_to: "G-TEST123456", page_location: "https://artgian.com.br/", page_title: "Artgian Studio", page_referrer: "https://google.com",
    }]]);
    expect(JSON.stringify(browser.dataLayer)).not.toContain("private-search");
    expect(Object.prototype.toString.call(browser.dataLayer![0])).toBe("[object Arguments]");
    expect(commands()).toContainEqual(["consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    }]);
  });

  it("counts public SPA pages once and blocks contact events on private routes", () => {
    analytics.saveAnalyticsConsent("accepted");
    analytics.syncAnalyticsPage(catalog);
    analytics.syncAnalyticsPage(catalog);
    expect(events()).toHaveLength(1);
    browser.location.pathname = product.href;
    analytics.syncAnalyticsPage(catalog);
    expect(events().map((entry) => entry[1])).toEqual(["page_view", "page_view", "view_item"]);
    browser.location.pathname = "/conta/pedidos/private-order";
    analytics.syncAnalyticsPage(catalog);
    analytics.trackContactClick("https://wa.me/5516997432741");
    expect(events()).toHaveLength(3);
    expect(browser["ga-disable-G-TEST123456"]).toBe(true);
    browser.location.pathname = "/";
    analytics.syncAnalyticsPage(catalog);
    expect(events()).toHaveLength(4);
  });

  it("sends only catalog fields for products and category-only contact data", () => {
    analytics.saveAnalyticsConsent("accepted");
    analytics.syncAnalyticsPage(catalog);
    analytics.trackAddToCart({ ...product, personalization: { ...product.personalization, label: "private-name" } }, 2, product.variants[0].key);
    analytics.trackContactClick("https://wa.me/5516997432741?text=private-message");
    const cart = events().find((entry) => entry[1] === "add_to_cart")![2] as Record<string, unknown>;
    expect(cart.currency).toBe("BRL");
    expect(cart.items).toEqual([analytics.analyticsItem(product, 2, product.variants[0].key)]);
    const contact = events().find((entry) => entry[1] === "contact_click")![2];
    expect(contact).toMatchObject({ contact_channel: "whatsapp" });
    const serialized = JSON.stringify(browser.dataLayer);
    expect(serialized).not.toMatch(/private-name|private-message|5516997432741/);
  });

  it("immediately stops events when consent is revoked", () => {
    analytics.saveAnalyticsConsent("accepted");
    analytics.syncAnalyticsPage(catalog);
    analytics.saveAnalyticsConsent("rejected");
    analytics.trackAddToCart(product, 1, product.variants[0].key);
    analytics.trackContactClick("https://wa.me/5516997432741");
    expect(events()).toHaveLength(1);
    expect(browser["ga-disable-G-TEST123456"]).toBe(true);
  });

  it("does not treat lookalike hosts as contact links", () => {
    expect(analytics.contactChannel("https://wa.me.evil.example")).toBeNull();
    expect(analytics.contactChannel("https://example.com/?url=https://wa.me/")).toBeNull();
    expect(analytics.contactChannel("mailto:hello@example.com")).toBe("email");
  });
});
