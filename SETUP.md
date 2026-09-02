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
pnpm dev
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
```

Endpoint de verificação e eventos:

```text
https://SEU_HOST/api/webhooks/instagram
```

O POST exige `X-Hub-Signature-256`. Eventos repetidos usam o ID externo como chave idempotente.

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

O perfil pessoal do Chrome nunca deve ser usado.

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

Esta versão não implementa clique de envio de primeiro contato; somente a inspeção segura em dry-run está preparada.

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

Inicie o worker persistente em outro terminal:

```bash
pnpm worker
```

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
