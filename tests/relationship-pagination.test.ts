import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { getBriefingsPage, getConversationsPage, getFunnelBoard, getLeadsPage } from "../src/db/relationship";
import { pagination, paginationHref } from "../src/features/leads/pagination";

const client = createClient({ url: ":memory:" });
const db = drizzle(client, { schema });
vi.mock("../src/db/commercial", () => ({ getCommercialDb: async () => db }));

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  const timestamp = "2026-10-19T12:00:00.000Z";
  for (let index = 0; index < 57; index++) {
    const id = `lead-${String(index).padStart(3, "0")}`;
    await db.insert(schema.leads).values({
      id, instagramUsername: `teste.${index}`, name: `ÁLVARO ${index}`,
      source: "Teste", score: 50, updatedAt: timestamp,
      segment: "Decoração", productInterest: index === 0 ? "100%_personalizado" : "Miniatura",
      leadType: index < 40 ? "consumer" : "partner",
      pipelineStage: index < 30 || index >= 40 ? "discovered" : "replied",
    });
    await db.insert(schema.conversations).values({ id: `conv-${id}`, leadId: id, lastMessageAt: timestamp });
    await db.insert(schema.briefings).values({ id: `brief-${id}`, leadId: id, updatedAt: timestamp });
  }
});
afterAll(() => client.close());

describe("paginação de relacionamento no banco", () => {
  it("limita a consulta e mantém ordem estável entre páginas empatadas", async () => {
    const first = await getLeadsPage({});
    const second = await getLeadsPage({ pagina: "2" });
    const last = await getLeadsPage({ pagina: "99999" });
    expect(first).toMatchObject({ total: 57, page: 1, pageCount: 3 });
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(25);
    expect(last.rows).toHaveLength(7);
    expect(last.page).toBe(3);
    const ids = [...first.rows, ...second.rows, ...last.rows].map((row) => row.id);
    expect(new Set(ids).size).toBe(57);
    expect(ids).toEqual([...ids].sort());
  });

  it("filtra antes da paginação, preservando acentos e busca literal", async () => {
    const filtered = await getLeadsPage({ busca: "álvaro", etapa: "discovered", pagina: "2" });
    expect(filtered.total).toBe(47);
    expect(filtered.rows).toHaveLength(22);
    expect(filtered.rows.every((row) => row.pipelineStage === "discovered")).toBe(true);
    expect((await getLeadsPage({ busca: "100%_" })).rows.map((row) => row.id)).toEqual(["lead-000"]);
    expect((await getLeadsPage({ busca: "DECORAÇÃO" })).total).toBe(57);
    expect((await getLeadsPage({ busca: "teste.56" })).rows[0].id).toBe("lead-056");
    expect(await getLeadsPage({ busca: "inexistente", pagina: "2" })).toMatchObject({ rows: [], total: 0, page: 1 });
  });

  it("pagina conversas e briefings sem duplicar registros com a mesma data", async () => {
    for (const [getPage, pageSize] of [[getConversationsPage, 25], [getBriefingsPage, 12]] as const) {
      const first = await getPage({});
      const second = await getPage({ pagina: "2" });
      expect(first.total).toBe(57);
      expect(first.rows).toHaveLength(pageSize);
      expect(second.rows).toHaveLength(pageSize);
      expect(new Set([...first.rows, ...second.rows].map((row) => row.lead.id)).size).toBe(pageSize * 2);
    }
  });

  it("pagina cada coluna e separa consumidores de parceiros sem reduzir contagens", async () => {
    const columns = [
      { title: "Entrada", stages: ["discovered"], dot: "" },
      { title: "Conversa", stages: ["replied"], dot: "" },
      { title: "Vazio", stages: ["order_confirmed"], dot: "" },
    ];
    const params = { consumer_1: "2", partner_1: "3" };
    const consumer = await getFunnelBoard(params, "consumer", columns);
    const partner = await getFunnelBoard(params, "partner", columns);
    expect(consumer.active).toBe(40);
    expect(partner.active).toBe(17);
    expect(consumer.columns[0]).toMatchObject({ total: 30, page: 2 });
    expect(consumer.columns[0].rows).toHaveLength(8);
    expect(consumer.columns[0].rows[0].id).toBe("lead-008");
    expect(consumer.columns[1]).toMatchObject({ total: 10, page: 1 });
    expect(consumer.columns[2]).toMatchObject({ total: 0, page: 1, rows: [] });
    expect(partner.columns[0]).toMatchObject({ total: 17, page: 3 });
    expect(partner.columns[0].rows).toHaveLength(1);
    expect(partner.columns[0].rows[0].leadType).toBe("partner");
  });
});

describe("parâmetros da paginação", () => {
  it.each([undefined, "", "-3", "0", "1.5", "Infinity", "NaN", "9007199254740993"])("normaliza página inválida %s", (value) => {
    expect(pagination(100, value, 25).page).toBe(1);
  });
  it("preserva filtros e páginas de outras colunas", () => {
    const href = paginationHref("/admin/funil", { consumer_1: "2", partner_1: "3", busca: "ação & arte" }, "consumer_1", 3);
    const params = new URL(href, "http://localhost").searchParams;
    expect(params.get("partner_1")).toBe("3");
    expect(params.get("consumer_1")).toBe("3");
    expect(params.get("busca")).toBe("ação & arte");
    expect(paginationHref("/admin/leads", { pagina: "2" }, "pagina", 1)).toBe("/admin/leads");
    expect(pagination(57, ["2", "3"], 25).page).toBe(2);
  });
});
