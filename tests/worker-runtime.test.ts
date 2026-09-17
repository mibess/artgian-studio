import { execFileSync } from 'node:child_process';
import { expect,it } from 'vitest';
it('loads product access in the standalone worker without Next.js module aliases',()=>{
 const output=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',"await import('./src/worker/processor.ts'); const repo=await import('./lib/products/repository.ts'); if(typeof repo.getProductRecords!=='function')throw new Error('Product repository missing'); console.log('worker imports OK')"],{encoding:'utf8',env:{...process.env,TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',OPENAI_API_KEY:''},timeout:15000});
 expect(output).toContain('worker imports OK');
});
