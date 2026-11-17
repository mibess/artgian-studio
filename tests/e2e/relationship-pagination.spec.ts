import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { expect, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { briefings, conversations, leads } from "../../db/schema";
import { loginAdmin } from "./admin-login";

test("relacionamento pagina listas, mantém filtros e navega colunas independentes", async ({ page }) => {
  await loginAdmin(page);
  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  const db = drizzle(client);
  const prefix = `pagination-${Date.now()}`;
  const ids = Array.from({ length: 72 }, (_, index) => `${prefix}-${String(index).padStart(3, "0")}`);
  try {
    for (const [index, id] of ids.entries()) {
      await db.insert(leads).values({
        id, instagramUsername: id, name: `Paginação ${index}`, source: "Teste",
        score: 100, pipelineStage: "discovered", leadType: index < 55 ? "consumer" : "partner",
        updatedAt: "2099-01-01T00:00:00Z",
      });
      await db.insert(conversations).values({ id, leadId: id, lastMessageAt: "2099-01-01T00:00:00Z" });
      await db.insert(briefings).values({ id, leadId: id, updatedAt: "2099-01-01T00:00:00Z" });
    }
    await page.goto(`/admin/leads?busca=${prefix}&etapa=discovered`);
    await expect(page.locator("tbody tr")).toHaveCount(25);
    const leadPages = page.getByRole("navigation", { name: "Paginação de leads" });
    await expect(leadPages).toContainText("1–25 de 72");
    await leadPages.getByRole("link", { name: "Próxima" }).click();
    await expect(leadPages).toContainText("26–50 de 72");
    expect(new URL(page.url()).searchParams.get("busca")).toBe(prefix);
    expect(new URL(page.url()).searchParams.get("etapa")).toBe("discovered");
    await expect(page.locator("tbody tr").first()).toContainText("Paginação 25");
    await page.getByLabel("Buscar leads").fill("sem-correspondencia-paginacao");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("Nenhum lead encontrado")).toBeVisible();
    expect(new URL(page.url()).searchParams.has("pagina")).toBe(false);

    for (const [route, size] of [["conversas", 25], ["briefings", 12]] as const) {
      await page.goto(`/admin/${route}`);
      const pager = page.getByRole("navigation", { name: `Paginação de ${route}` });
      await expect(page.locator(`main a[href^="/admin/leads/${prefix}"]`)).toHaveCount(size);
      await pager.getByRole("link", { name: "Próxima" }).click();
      await expect(pager).toContainText(`${size + 1}–${size * 2}`);
      await expect(page.locator(`main a[href^="/admin/leads/${prefix}"]`).first()).toContainText(`Paginação ${size}`);
    }

    await page.goto("/admin/funil");
    const consumer = page.getByRole("region", { name: "Funil de consumidores: Entrada", exact: true });
    const partner = page.getByRole("region", { name: "Funil de parceiros: Entrada", exact: true });
    await expect(consumer.locator(`a[href^="/admin/leads/${prefix}"]`)).toHaveCount(8);
    await consumer.getByRole("link", { name: "Próxima" }).click();
    await expect(consumer).toContainText("Paginação 8");
    await expect(partner).toContainText("Paginação 55");
    await partner.getByRole("link", { name: "Próxima" }).click();
    await expect(partner).toContainText("Paginação 63");
    await expect(consumer).toContainText("Paginação 8");
    expect(new URL(page.url()).searchParams.get("consumer_1")).toBe("2");
    expect(new URL(page.url()).searchParams.get("partner_1")).toBe("2");

    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["leads", "conversas", "briefings", "funil"]) {
      await page.goto(`/admin/${route}`);
      await expect(page.getByRole("navigation", { name: /Paginação de/ }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.screenshot({ path: "test-results/relationship-funnel-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Funis comerciais", exact: true })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Menu administrativo" })).toBeVisible();
    await page.screenshot({ path: "test-results/relationship-funnel-desktop.png", fullPage: true });
  } finally {
    await db.delete(briefings).where(inArray(briefings.leadId, ids));
    await db.delete(conversations).where(inArray(conversations.leadId, ids));
    await db.delete(leads).where(inArray(leads.id, ids));
    client.close();
  }
});
