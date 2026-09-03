# Manual do operador — Artgian Comercial

O Artgian Comercial é a área local de relacionamento e vendas da Artgian Studio. Ele organiza oportunidades, conversas, briefings, orçamentos e pedidos sem prometer informações que não estejam cadastradas.

## 1. Instalação

Requisitos:

- Node.js 24 LTS;
- pnpm 11;
- uma cópia local deste projeto.

Na pasta do projeto:

```bash
pnpm install
cp .env.example .env.local
pnpm db:setup
pnpm dev:all
```

Acesse `http://localhost:3000/comercial`. A área administrativa usa o usuário e a senha definidos em `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

O modo inicial inclui dados marcados como demonstração. Para começar vazio, defina `COMMERCIAL_DEMO_MODE=false` antes da primeira execução e use um banco novo.

## 2. Configuração do negócio

O arquivo real fica em `config/business.json` e não entra no Git. O painel **Configurações** permite completar:

- link oficial do WhatsApp;
- região de atendimento/entrega.

Campos com `A_DEFINIR` nunca são inventados. A ação dependente fica bloqueada até a operadora salvar um valor válido.

## 3. Banco local

O padrão é:

```text
DATABASE_URL=file:./data/artgian.db
COMMERCIAL_DATABASE_MODE=local
```

Na abertura, a aplicação aplica as migrações do Drizzle, habilita chaves estrangeiras, WAL e `busy_timeout`. Jobs, mensagens e idempotência permanecem salvos após reinícios.

### Backup

Pare o worker e execute:

```bash
pnpm db:backup
```

O arquivo será salvo em `backups/`, pasta ignorada pelo Git.

### Restauração

1. Pare a aplicação e o worker.
2. Guarde o arquivo atual de `data/` em outro local.
3. Copie o backup escolhido para o caminho definido em `DATABASE_URL`.
4. Inicie a aplicação e confira Dashboard, Leads e Jobs.

Nunca restaure um arquivo por cima de um banco que esteja em uso.

Em uma implantação persistente, use `COMMERCIAL_DATABASE_MODE=turso`,
configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` e execute `pnpm db:migrate`
antes de habilitar o webhook. Mantenha `COMMERCIAL_DEMO_MODE=false` nesse
ambiente para não inserir dados demonstrativos.

### Backup e recuperação em produção (Turso)

O comando `pnpm db:backup` cobre somente SQLite local e recusa bancos remotos.
Em produção, use duas camadas independentes:

1. **PITR gerenciado:** a Turso cria pontos de recuperação a cada `COMMIT`.
   A retenção publicada é de 24 horas no plano Free e de 10, 30 ou 90 dias nos
   planos Developer, Scaler e Pro. Consulte a política atual antes de depender
   desse prazo: <https://docs.turso.tech/features/point-in-time-recovery>.
2. **Exportação lógica externa:** gere regularmente um `.dump`, armazene-o
   criptografado fora da conta Turso e aplique retenção compatível com a LGPD.
   O dump contém dados comerciais e pessoais e deve ter acesso restrito.

O projeto inclui um exportador que cifra o dump com `age` antes de gravá-lo.
Instale `age`, configure `TURSO_BACKUP_DATABASE_NAME` e a chave pública em
`BACKUP_AGE_RECIPIENT`, então execute:

```bash
pnpm db:backup:production
```

Agende esse comando diariamente no computador operacional e copie o arquivo
`.sql.age` para um armazenamento externo com retenção. A chave privada de
recuperação não deve permanecer na Vercel nem no mesmo diretório dos backups.

Exemplo de exportação, em uma estação autenticada na Turso:

```bash
turso db shell NOME_DO_BANCO .dump > artgian-AAAA-MM-DDTHH-MM-SSZ.sql
```

Runbook de recuperação por PITR:

1. pause as automações e bloqueie temporariamente as fontes de escrita;
2. registre em UTC o instante imediatamente anterior ao incidente;
3. crie um banco novo, sem alterar ou apagar o original:

   ```bash
   turso db create artgian-recovery-AAAAMMDD \
     --from-db NOME_DO_BANCO_ORIGINAL \
     --timestamp INSTANTE_RFC3339
   ```

4. crie uma credencial exclusiva para o banco recuperado e valide schema,
   contagens, pedidos, mensagens, auditoria e integridade referencial;
5. atualize `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` na Vercel, faça um novo
   deployment e execute um smoke test somente leitura;
6. libere as escritas e automações gradualmente;
7. preserve o banco original até encerrar a análise do incidente. A exclusão
   nunca faz parte do procedimento de restauração.

Para recuperar a partir do dump, crie outro banco em vez de importar sobre o
original:

```bash
age --decrypt --identity /CAMINHO/CHAVE-PRIVADA \
  --output ./artgian-backup.sql ./artgian-backup.sql.age
turso db create artgian-recovery-AAAAMMDD --from-dump ./artgian-backup.sql
```

A restauração deve ser ensaiada periodicamente em um banco descartável. A
documentação oficial dos comandos de dump e carga está em
<https://docs.turso.tech/cli/db/shell>.

## 4. OpenAI

Preencha:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_MODEL_FAST=
OPENAI_MONTHLY_BUDGET_USD=
OPENAI_INPUT_COST_PER_1M_USD=
OPENAI_OUTPUT_COST_PER_1M_USD=
```

Consulte os preços oficiais do modelo no momento da configuração e informe os custos por milhão de tokens. Sem orçamento e custos válidos, o sistema usa as regras locais de classificação e não chama a API silenciosamente.

O modelo principal decide a próxima ação e redige mensagens. O modelo rápido é reservado a classificação e extração. Toda saída é validada; preço e prazo não cadastrados causam fallback seguro ou revisão humana.

No piloto, cada mensagem recebida cria primeiro uma sugestão local segura. Em
seguida, a sugestão é aprimorada pela OpenAI em segundo plano, desde que ainda
esteja como rascunho. Simulações pelo painel aguardam a geração para facilitar
a validação. A OpenAI nunca aciona o envio: a resposta só sai do sistema depois
do clique **Aprovar e enviar**.

## 5. Instagram oficial

Em agosto de 2026, a coleção oficial da Meta documenta a Conversations API para contas profissionais, com token de usuário capaz de gerenciar mensagens e permissões como `instagram_business_basic` e `instagram_business_manage_messages`. Webhooks devem ser usados para mensagens inbound e a aplicação precisa deduplicar retries. Confirme novamente as regras antes de qualquer piloto, pois a plataforma pode mudar:

- [Conversations API — coleção oficial Meta](https://www.postman.com/meta/instagram/folder/23987686-6a91368f-1fa8-4614-9ed6-7d1e08c21e62)
- [Webhooks — coleção oficial Meta](https://www.postman.com/meta/messenger-platform-api/folder/22794852-b5d97624-14d8-4e67-a2e4-529add49ca58)
- [Documentação da Instagram Platform](https://developers.facebook.com/docs/instagram-platform/)

Configure:

```text
INSTAGRAM_APP_SECRET=
INSTAGRAM_PAGE_ACCESS_TOKEN=
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_GRAPH_API_VERSION=v26.0
INSTAGRAM_TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
```

Endpoint de verificação e eventos:

```text
https://SEU_HOST/api/webhooks/instagram
```

O POST exige `X-Hub-Signature-256`. Eventos repetidos usam o ID externo como chave idempotente.

### Confiabilidade e renovação

- O webhook continua sendo o caminho em tempo real.
- A rota `/api/cron/instagram` executa diariamente uma reconciliação das
  conversas recentes e recupera eventos eventualmente perdidos.
- A rota exige `Authorization: Bearer CRON_SECRET`; a Vercel envia esse header
  automaticamente nos Cron Jobs.
- Tokens renovados são armazenados no Turso com AES-256-GCM. A chave é derivada
  do `INSTAGRAM_APP_SECRET` ou, quando definida, de
  `INSTAGRAM_TOKEN_ENCRYPTION_KEY`.
- A renovação é tentada quando a validade é desconhecida ou faltam 14 dias para
  o vencimento. O painel em `/comercial/configuracoes` mostra o último estado,
  sincronização e erro sem revelar credenciais.
- No plano Hobby, mantenha o cron em uma execução por dia. O webhook cobre o
  tempo real e o cron funciona como reconciliação de segurança.

## 6. Dry-run inbound

Abra **Conversas → Simular inbound**. A simulação:

1. cria ou encontra o lead sem duplicidade;
2. classifica a intenção;
3. calcula os cinco componentes do score;
4. extrai quantidade, prazo e local quando presentes;
5. cria briefing e job persistente;
6. aplica opt-out e escalada quando necessário;
7. não envia nada ao Instagram.

## 7. Chrome e CDP

O suporte ao navegador existe apenas para tarefas autorizadas. Inicie um Chrome separado usando o diretório definido em `CHROME_PROFILE_DIR` e exponha a porta CDP em `CHROME_CDP_URL`.

Regras implementadas:

- domínio limitado a `instagram.com`;
- aba exclusiva criada pelo agente;
- nenhum `bringToFront()`;
- mutex para impedir jobs simultâneos;
- aba fechada em `finally`;
- nenhum fingerprint falso ou API privada.
- primeiro contato somente depois de o texto ser aprovado no painel;
- duas travas de ambiente (`OUTBOUND_AUTOMATION_ENABLED` e
  `BROWSER_SEND_ENABLED`), além das pausas do painel;
- intervalo aleatório, horário, teto diário e aquecimento gradual;
- screenshot, snapshot de acessibilidade e diagnóstico local em falhas;
- envio incerto nunca é repetido automaticamente;
- falhas consecutivas abrem o circuit breaker e pausam outbound.

O perfil pessoal do Chrome nunca deve ser usado.

Exemplo no macOS, com o Chrome encerrado antes de iniciar:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$PWD/.chrome-profile"
```

No Linux, ajuste o executável se a distribuição usar outro caminho:

```bash
google-chrome \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$PWD/.chrome-profile"
```

No Windows PowerShell, execute a partir da raiz do projeto:

```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-address=127.0.0.1 `
  --remote-debugging-port=9222 `
  --user-data-dir="$PWD\.chrome-profile"
```

Configure somente na máquina do worker:

```text
CHROME_CDP_URL=http://127.0.0.1:9222
CHROME_PROFILE_DIR=.chrome-profile
```

Faça login manualmente no Instagram nesse perfil. A porta CDP controla a
sessão inteira: mantenha-a em `127.0.0.1`, nunca exponha em `0.0.0.0` e não use
uma máquina compartilhada. A Vercel não acessa esse Chrome; jobs
`send_outbound` são deliberadamente ignorados pelo worker serverless e
processados apenas por `pnpm worker` na máquina autorizada.

## 8. Ativação do outbound

O padrão obrigatório é:

```text
OUTBOUND_AUTOMATION_ENABLED=false
```

Antes de mudar:

1. rever a documentação oficial atual da Meta;
2. obter autorização explícita da operadora;
3. aprovar o dry-run;
4. definir limites diários, intervalos e horário operacional;
5. manter opt-out e pausa geral testados;
6. realizar um smoke test pequeno e supervisionado.

O primeiro contato nunca usa a API oficial. Ele segue este fluxo:

1. cadastre o perfil e somente sinais públicos verdadeiros;
2. o sistema calcula o score ICP e cria o lead sem duplicidade;
3. gere o rascunho; a OpenAI é usada apenas quando orçamento e custos estão
   válidos, com fallback local seguro;
4. revise e aprove o texto;
5. após autorização operacional, abra as duas travas de ambiente, retire a
   pausa de outbound, ative uma campanha e coloque o contato na fila;
6. o worker local abre uma aba própria, envia e fecha somente essa aba;
7. quando a pessoa responder, o webhook troca a propriedade do fio de
   `browser` para `api`; o navegador nunca responde novamente naquele fio.

A coleção oficial da Meta informa que conversas da Send API começam quando a
pessoa envia uma mensagem ao perfil profissional. Por isso, DM fria pela API
permanece bloqueada no código. O envio pelo navegador usa a interface comum da
conta, sem API privada, mascaramento ou evasão; a operadora deve revisar as
regras da plataforma antes de cada piloto.

Estados de segurança importantes:

- `browser_contact_pending`: prospecto identificado, sem contato;
- `waiting_inbound_reply`: primeiro contato confirmado pelo navegador;
- `api_active`: resposta recebida pelo webhook e API oficial proprietária;
- `human_review_required`: ação separada para análise;
- `do_not_contact`: bloqueio permanente em todas as campanhas.

### Agendamento de follow-ups dentro de 24 horas

O cron diário atual serve para reconciliação do Instagram, mas não para
follow-ups: no plano Hobby ele executa no máximo uma vez por dia e pode variar
até 59 minutos dentro da hora configurada. Também não há retry automático do
cron. Referência: <https://vercel.com/docs/cron-jobs/usage-and-pricing>.

A opção operacional mais simples é migrar o projeto comercial para Vercel Pro
e criar uma rota de cron separada, exclusiva para o worker, executada a cada
cinco minutos. Mantenha lock distribuído, idempotência e a revalidação da
janela do Instagram no momento de preparar e no momento de enviar. Recomenda-se
preparar o rascunho 16 a 18 horas após a última mensagem, deixando margem para
revisão humana antes das 24 horas.

O projeto implementa a alternativa por evento individual com atraso no QStash.
Configure `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` e
`QSTASH_NEXT_SIGNING_KEY`. A rota `POST /api/tasks/followups` valida a assinatura
`Upstash-Signature` e acorda somente o job informado. O banco continua sendo a
fonte de verdade e cancela o follow-up se houver nova resposta, opt-out, recusa
ou janela encerrada. Sem QStash, o job é persistido como `database_only`, mas
depende do worker local ou do cron diário e não tem precisão operacional.
Referências:
<https://upstash.com/docs/qstash/features/delay> e
<https://upstash.com/docs/qstash/howto/signature>.

Não use a tag `HUMAN_AGENT` para follow-ups automáticos. Ela é destinada a um
agente humano tratando uma solicitação do usuário fora da janela padrão. Até
autorização explícita, mantenha `FOLLOWUP_REVIEW_ENABLED=false` e
`followups_paused=true`.

O horário é calculado a partir da última mensagem inbound, não da resposta da
empresa. O padrão é 18 horas (`FOLLOWUP_INTERVAL_HOURS=18`) e o código limita a
configuração a no máximo 20 horas. Todo follow-up nasce como rascunho para
revisão humana; a janela de 24 horas é validada novamente no envio. Por
segurança, esta versão limita cada ciclo inbound a um único follow-up, mesmo se
`MAX_FOLLOWUPS` for configurado acima de 1.

### Prospecção outbound assistida

A página **Campanhas e prospecção** permite cadastrar perfis, registrar a fonte
e a justificativa de qualificação, preparar um rascunho e salvar a revisão. Nada
nessa fila envia mensagens. Um perfil já associado a uma DM inbound dentro de
24 horas recebe a política `inbound_window`; os demais ficam como
`manual_only`.

Campanhas são separadas entre **Clientes** e **Parceiros**. O cadastro registra
categoria, bio, localização e um sinal público verificável; esses dados
alimentam score ICP, prioridade e personalização. Perfis em `do_not_contact` ou
já presentes em outra campanha ativa são recusados.

Ativar uma campanha exige simultaneamente:

```text
OUTBOUND_AUTOMATION_ENABLED=true
BROWSER_SEND_ENABLED=true
automation_paused=false
outbound_paused=false
```

Também são obrigatórios campanha ativa, rascunho aprovado, horário válido,
limite diário disponível e worker local conectado. Mesmo ativa, uma campanha
não autoriza primeiro contato frio pela API oficial. Comentários continuam
isolados e não são convertidos automaticamente em DM.

Valores iniciais recomendados para o piloto:

```text
MAX_DMS_PER_DAY=5
MIN_SECONDS_BETWEEN_DMS=300
MAX_SECONDS_BETWEEN_DMS=900
OPERATING_HOURS=09:00-18:00
OPERATING_TIMEZONE=America/Sao_Paulo
OUTBOUND_WARMUP_STARTED_AT=AAAA-MM-DDTHH:MM:SSZ
OUTBOUND_WARMUP_START_DAILY=5
OUTBOUND_WARMUP_WEEKLY_INCREASE=5
OUTBOUND_FAILURE_THRESHOLD=3
OUTBOUND_OPT_OUT_MIN_SAMPLE=5
OUTBOUND_OPT_OUT_RATE_THRESHOLD=0.2
```

Experimentos distribuem controle/variante de modo determinístico, registram
contatos e respostas e não declaram vencedor antes da amostra mínima. Apenas um
experimento pode ficar ativo por vez. A estratégia não altera claims, regras
financeiras ou limites sozinha.

### Homologação do primeiro contato

1. mantenha `BROWSER_SEND_ENABLED=false` e execute os testes automatizados;
2. inicie o Chrome dedicado e confira no painel que a conexão está configurada;
3. cadastre uma conta de teste autorizada e aprove um texto sem promessa;
4. somente com autorização explícita, defina `BROWSER_SEND_ENABLED=true`, abra
   as pausas e ative a campanha de teste;
5. inicie `pnpm worker` e acompanhe o contato no Instagram;
6. envie uma resposta pela conta de teste e confirme `channel_handoff` na
   timeline, `instagram_channel_handoff_completed` na auditoria e
   `inbound_reply_received` nas métricas;
7. pause novamente a campanha após o smoke test.

Se o worker cair durante a confirmação de envio, o job passa para revisão e
exige conferência manual no Instagram. Nunca altere esse job diretamente para
`pending`, pois isso pode duplicar a mensagem.

## 9. WhatsApp

Cadastre um link `wa.me` ou `api.whatsapp.com` em **Configurações**. Enquanto o valor for `A_DEFINIR`, o resumo do briefing é gerado, mas o CTA fica bloqueado. O histórico do Instagram continua associado ao lead depois do handoff.

## 10. Operação diária

1. Verifique o **Radar de oportunidades**.
2. Atenda primeiro os leads com intenção forte e inbound recente.
3. Revise **Exceções** antes de liberar mensagens.
4. Complete briefings somente com dados da conversa.
5. Cadastre preços e prazos no **Catálogo** apenas quando verificados.
6. Registre o orçamento e confirme o pedido no lead.
7. Confira custo de IA, jobs esgotados e opt-outs.

Para subir painel e worker em desenvolvimento com um único comando:

```bash
pnpm dev:all
```

Em produção, mantenha a aplicação na Vercel e execute `pnpm worker` somente no
computador dedicado ao primeiro contato. Follow-ups por QStash e DMs inbound
continuam independentes desse computador.

## 11. Pausas e falhas

O botão global **Pausar automação** interrompe o worker sem apagar jobs. Há pausas separadas para outbound, follow-ups e respostas automáticas.

Em caso de autenticação perdida, falhas repetidas, custo atingido, opt-outs anormais ou divergência de dados:

1. pause a automação geral;
2. abra **Revisão humana** e **Automações**;
3. corrija a credencial ou dado de origem;
4. faça um dry-run;
5. retome manualmente.

Jobs esgotados ficam em `dead_letter`; não entram em retry infinito.

## 12. Troca de credenciais

1. Pause a automação.
2. Gere/revogue a credencial no provedor oficial.
3. Atualize somente `.env.local`.
4. Reinicie app e worker.
5. Verifique o webhook ou a integração em dry-run.
6. Retome manualmente.

Tokens nunca devem ser enviados em conversa, logs ou commits.

## 13. Validação

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

O E2E usa a área local protegida e nunca acessa uma conta real do Instagram.
