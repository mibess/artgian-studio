import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

const envFile=process.argv.find(a=>a.startsWith('--env='))?.slice(6);
if(!envFile)throw new Error('Informe --env=/caminho/credenciais.env.');
const env=parseEnv(readFileSync(envFile,'utf8'));
if(!env.TURSO_DATABASE_URL||!env.TURSO_AUTH_TOKEN)throw new Error('Credenciais do banco ausentes.');
const client=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries;
const migration=journal.find(entry=>entry.tag==='0016_volatile_namor');
const previous=journal.find(entry=>entry.idx===migration.idx-1);
const sql=readFileSync(`drizzle/${migration.tag}.sql`,'utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const tx=await client.transaction('write');
try{
 const latest=(await tx.execute('SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1')).rows[0];
 if(Number(latest?.created_at)===migration.when){if(latest.hash!==hash)throw new Error('A migração já aplicada possui outro conteúdo.');console.log('Migração já aplicada; nenhuma alteração.');await tx.rollback();}
 else{
  if(Number(latest?.created_at)!==previous.when)throw new Error('O banco não está na migração anterior esperada. Nenhuma alteração realizada.');
  const products=(await tx.execute('SELECT * FROM catalog_products ORDER BY id')).rows;
  const items=(await tx.execute('SELECT id,product_id FROM order_items ORDER BY id')).rows;
  console.log(`Pré-verificação: ${products.length} produtos, ${items.length} itens de pedidos. Migração anterior confirmada.`);
  if(!process.argv.includes('--apply')){await tx.rollback();console.log('Verificação concluída; use --apply para migrar.');}
  else{
   const stamp=new Date().toISOString().replace(/[:.]/g,'-');mkdirSync('backups',{recursive:true});
   const backup=path.resolve('backups',`catalog-before-${stamp}.json`);
   writeFileSync(backup,JSON.stringify({at:new Date().toISOString(),migration:latest,products,orderItems:items},(_key,value)=>typeof value==='bigint'?String(value):value,2),{mode:0o600});
   for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await tx.execute(statement);
   await tx.execute({sql:'INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)',args:[hash,migration.when]});
   const unified=(await tx.execute('SELECT store_id,storefront,base_price_cents FROM catalog_products WHERE store_id IS NOT NULL')).rows;
   if(unified.length!==6||unified.some(p=>!JSON.parse(String(p.storefront)).variants.length))throw new Error('Validação do catálogo migrado falhou.');
   const after=(await tx.execute('SELECT count(*) AS total FROM order_items')).rows[0];
   if(Number(after.total)!==items.length)throw new Error('A quantidade de itens de pedidos mudou.');
   await tx.commit();console.log(`Migração aplicada: ${unified.length} produtos unificados. Backup: ${backup}`);
  }
 }
} catch(error){await tx.rollback().catch(()=>{});throw error;} finally{tx.close();client.close();}
