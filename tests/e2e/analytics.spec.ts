import { expect, test, type Page } from "@playwright/test";

// Enable explicitly with NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123456.
// Requests to Google are intercepted: this never sends test traffic to GA4.
test.skip(!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, "Analytics is disabled without a measurement ID");

async function analyticsEvents(page: Page) {
  return page.evaluate(() =>
    (window.dataLayer || []).map((entry) => Array.from(entry as IArguments)).filter((entry) => entry[0] === "event"),
  );
}

test("analytics requires opt-in, sanitizes navigation and stops after revocation", async ({ page }) => {
  let scriptRequests = 0;
  await page.route("https://www.googletagmanager.com/gtag/js?*", async (route) => {
    scriptRequests++;
    await route.fulfill({ contentType: "application/javascript", body: "/* mocked Google tag */" });
  });
  await page.route("https://*.google-analytics.com/**", (route) => route.abort());
  await page.goto("/?email=private@example.com#private-name");
  await expect(page.getByRole("complementary", { name: "Preferências de cookies" })).toBeVisible();
  expect(scriptRequests).toBe(0);
  expect(await analyticsEvents(page)).toEqual([]);
  await page.getByRole("button", { name: "Apenas essenciais", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Preferências de cookies", exact: true })).toBeVisible();
  expect(scriptRequests).toBe(0);
  await page.getByRole("button", { name: "Preferências de cookies", exact: true }).click();
  await page.getByRole("button", { name: "Permitir estatísticas", exact: true }).click();
  await expect.poll(() => scriptRequests).toBe(1);
  await expect.poll(async () => (await analyticsEvents(page)).length).toBe(1);
  expect(JSON.stringify(await analyticsEvents(page))).not.toMatch(/private@example|private-name/);
  // The privacy policy uses Next Link, so this exercises a real SPA transition.
  await page.locator('a[href="/politica-de-privacidade"]').first().click();
  await expect(page).toHaveURL(/\/politica-de-privacidade$/);
  await expect.poll(async () => (await analyticsEvents(page)).length).toBe(2);
  await page.locator('a[href="https://wa.me/5516997432741"]').evaluate((link) => {
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await page.locator('a[href="https://wa.me/5516997432741"]').click();
  await expect.poll(async () => (await analyticsEvents(page)).some((entry) => entry[1] === "contact_click")).toBe(true);
  expect(JSON.stringify(await analyticsEvents(page))).not.toContain("5516997432741");
  await page.getByRole("button", { name: "Preferências de cookies", exact: true }).click();
  await page.getByRole("button", { name: "Apenas essenciais", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preferências de cookies", exact: true })).toBeVisible();
  await expect.poll(() => analyticsEvents(page)).toEqual([]);
  expect(scriptRequests).toBe(1);
});

test("an opted-in visitor never loads Google on a private page", async ({ page }) => {
  let scriptRequests = 0;
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    scriptRequests++;
    await route.abort();
  });
  await page.addInitScript(() => localStorage.setItem("artgian:analytics-consent:v1", "accepted"));
  await page.goto("/login?next=%2Fcomprar&email=private@example.com");
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  expect(scriptRequests).toBe(0);
  expect(await analyticsEvents(page)).toEqual([]);
});
