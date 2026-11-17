import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { conversations, leads } from "../../db/schema";
import { loginAdmin } from "./admin-login";

test("conversas e comentários oferecem acesso ao Instagram no desktop e celular", async ({ page, request }) => {
  const denied = await request.get("/api/admin/conversations/unknown/instagram");
  expect(denied.status()).toBe(401);
  await loginAdmin(page);
  const client = createClient({ url: process.env.E2E_DATABASE_URL! });
  const db = drizzle(client);
  const id = `instagram-links-${Date.now()}`;
  try {
    await db.insert(leads).values({ id, instagramUsername: "cliente.referencia", name: "Cliente Referência", source: "Instagram" });
    await db.insert(conversations).values({ id, leadId: id, externalId: "123:456", lastMessageAt: "2099-01-01T00:00:00Z" });
    await page.goto("/admin/conversas");
    const link = page.getByRole("link", { name: "Abrir conversa no Instagram", exact: true }).first();
    await expect(link).toHaveAttribute("href", `/api/admin/conversations/${id}/instagram`);
    await expect(link).toHaveAttribute("target", "_blank");
    const response = await page.request.get(`/api/admin/conversations/${id}/instagram`, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe("https://ig.me/m/cliente.referencia");
    await page.goto(`/admin/leads/${id}`);
    await expect(page.getByRole("link", { name: "Abrir conversa no Instagram", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "@cliente.referencia", exact: true })).toHaveAttribute("href", "https://www.instagram.com/cliente.referencia/");
    await db.update(conversations).set({ externalId: "comment:456" }).where(eq(conversations.id, id));
    await page.reload();
    await expect(page.getByRole("link", { name: "Ver comentário no Instagram", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/conversas");
    await expect(page.getByRole("link", { name: "Ver comentário no Instagram", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/instagram-links-mobile.png", fullPage: true });
  } finally {
    await db.delete(conversations).where(eq(conversations.id, id));
    await db.delete(leads).where(eq(leads.id, id));
    client.close();
  }
});
