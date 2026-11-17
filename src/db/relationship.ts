import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { briefings, conversations, leads } from "../../db/schema";
import { pagination, queryValue, type PaginationParams } from "../features/leads/pagination";
import { getCommercialDb } from "./commercial";

export async function getLeadsPage(params: PaginationParams) {
  const db = await getCommercialDb();
  const query = queryValue(params.busca).trim().toLocaleLowerCase("pt-BR");
  const stage = queryValue(params.etapa);
  let searchable = sql`coalesce(${leads.name}, '') || ' ' || ${leads.instagramUsername} || ' ' || coalesce(${leads.productInterest}, '') || ' ' || coalesce(${leads.segment}, '')`;
  // SQLite lower() only handles ASCII; keep Portuguese case-insensitive search.
  for (const letter of "ÁÀÂÃÉÊÍÓÔÕÚÜÇ") {
    searchable = sql`replace(${searchable}, ${letter}, ${letter.toLocaleLowerCase("pt-BR")})`;
  }
  const where = and(
    query ? sql`instr(lower(${searchable}), ${query}) > 0` : undefined,
    stage && stage !== "all" ? eq(leads.pipelineStage, stage) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(leads).where(where);
  const paging = pagination(total, params.pagina, 25);
  const rows = await db.select().from(leads).where(where)
    .orderBy(desc(leads.score), desc(leads.updatedAt), asc(leads.id))
    .limit(paging.pageSize).offset(paging.offset);
  return { rows, ...paging };
}

export async function getConversationsPage(params: PaginationParams) {
  const db = await getCommercialDb();
  const [{ total }] = await db.select({ total: count() }).from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id));
  const paging = pagination(total, params.pagina, 25);
  const rows = await db.select({ conversation: conversations, lead: leads }).from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .orderBy(desc(conversations.lastMessageAt), asc(conversations.id))
    .limit(paging.pageSize).offset(paging.offset);
  return { rows, ...paging };
}

export async function getBriefingsPage(params: PaginationParams) {
  const db = await getCommercialDb();
  const [{ total }] = await db.select({ total: count() }).from(briefings)
    .innerJoin(leads, eq(briefings.leadId, leads.id));
  const paging = pagination(total, params.pagina, 12);
  const rows = await db.select({ briefing: briefings, lead: leads }).from(briefings)
    .innerJoin(leads, eq(briefings.leadId, leads.id))
    .orderBy(desc(briefings.updatedAt), asc(briefings.id))
    .limit(paging.pageSize).offset(paging.offset);
  return { rows, ...paging };
}

export type FunnelColumn = { title: string; stages: string[]; dot: string };

export async function getFunnelBoard(params: PaginationParams, type: "consumer" | "partner", columns: FunnelColumn[]) {
  const db = await getCommercialDb();
  const typeFilter = type === "partner" ? eq(leads.leadType, "partner") : ne(leads.leadType, "partner");
  const counts = await db.select({ stage: leads.pipelineStage, total: count() })
    .from(leads).where(typeFilter).groupBy(leads.pipelineStage);
  const active = counts.filter(({ stage }) => stage !== "closed").reduce((sum, row) => sum + row.total, 0);
  const pages = await Promise.all(columns.map(async (column, index) => {
    const pageKey = `${type}_${index + 1}`;
    const total = counts.filter(({ stage }) => column.stages.includes(stage)).reduce((sum, row) => sum + row.total, 0);
    const paging = pagination(total, params[pageKey], 8);
    const rows = total ? await db.select().from(leads)
      .where(and(typeFilter, inArray(leads.pipelineStage, column.stages)))
      .orderBy(desc(leads.score), desc(leads.updatedAt), asc(leads.id))
      .limit(paging.pageSize).offset(paging.offset) : [];
    return { ...column, ...paging, rows, pageKey };
  }));
  return { active, columns: pages };
}
