import { sql } from "drizzle-orm";
import { leads } from "../db/schema";
import { getCommercialDb } from "../src/db/commercial";

const db = await getCommercialDb();
const [result] = await db.select({ total: sql<number>`count(*)` }).from(leads);
console.log(`Banco comercial pronto: ${Number(result.total)} leads disponíveis.`);
