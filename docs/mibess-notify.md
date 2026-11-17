# Notificações da Artgian

A Artgian publica um evento de negócio no Mibess Notify. O Notify resolve as regras,
templates, canais e entregas da operação e do comprador. Não há credencial de
provedor, texto de mensagem ou chamada administrativa no publicador da loja.
Com `MIBESS_NOTIFY_CUSTOMER_ENABLED=false` (padrão), o contrato interno permanece
igual. Quando habilitada, a flag acrescenta `recipient` e `data.orderUrl` aos
eventos futuros e permite as etapas de preparação descritas abaixo.
**Aceito pelo Notify (`202`) não significa mensagem enviada ou entregue.**

## Eventos e origem dos dados

| Mudança confirmada | Evento | Identidade persistente |
| --- | --- | --- |
| Primeira aprovação validada do pagamento | `ORDER_PAID` | `artgian:order:<id>:paid:v1` |
| Transição para `preparing` (flag de compradores ativa) | `ORDER_STATUS_CHANGED`, `PREPARING`, Em preparação | `artgian:order:<id>:fulfillment:<historyId>:v1` |
| Transição para `ready_to_ship` (flag de compradores ativa) | `ORDER_STATUS_CHANGED`, `READY_TO_SHIP`, Pronto para envio | mesma forma, outro ID do histórico |
| Transição para `shipped` | `TRACKING_POSTED`, `POSTED`, Enviado | `artgian:order:<id>:fulfillment:<historyId>:v1` |
| Transição para `out_for_delivery` | `TRACKING_STATUS_CHANGED`, `OUT_FOR_DELIVERY`, Saiu para entrega | mesma forma, outro ID do histórico |
| Transição para `delivered` | `TRACKING_STATUS_CHANGED`, `DELIVERED`, Entregue | mesma forma, outro ID do histórico |

`lib/embedded-payments.ts` cobre a resposta de criação, webhook, consultas de
reconciliação e recuperação de resposta incerta. As verificações de pedido,
tentativa, ID do pagamento, moeda, valor e precedência permanecem antes da outbox.
`lib/redirect-payments.ts` aplica a aprovação do checkout antigo a partir do webhook
autenticado, conferindo referência, valor e moeda dentro da transação. Eventos
atrasados não reabrem pedidos pagos/estornados nem trocam o pagamento já liquidado.
A comparação do checkout antigo preserva seu cálculo de total pago/frete.

`orderNumber` é o prefixo de oito caracteres do UUID usado pela interface da
Artgian; `orderId` e `correlationId` conservam o UUID completo. Nome e total vêm
do pedido persistido. `amount` é `totalCents / 100`; `amountFormatted` usa divisão
inteira e centavos, separador decimal e milhares brasileiros, sem depender de
locale do worker. O método vem da tentativa persistida (`PIX`, `Cartão`, `Boleto`);
no checkout antigo vem da resposta autenticada também registrada em `payment_events`.
`occurredAt` é o horário da confirmação/transição local, persistido na mesma
transação em `orders.updated_at` ou no histórico, e no snapshot imutável da outbox.

`lib/order-fulfillment.ts` insere o evento e seu registro de histórico juntos.
Correção de observação ou código sem mudar etapa não publica; voltar a uma etapa
e avançar novamente pode gerar uma nova notificação legítima, com outro ID.
Código de rastreio é opcional. Não existe evento de exceção estruturado no domínio;
portanto `TRACKING_EXCEPTION` não foi criado. Gerar etiqueta, consultar pedido,
retornar do navegador, criar preferência ou emitir Pix/boleto não gera evento.

## Compradores e consentimento

O checkout oferece uma caixa opcional, inicialmente desmarcada, para receber
confirmação e andamento **deste pedido** pelo WhatsApp. A API só aceita o booleano
`true` como adesão e grava `whatsapp_opt_in`, data do servidor e origem
`artgian_checkout_v1` no pedido. Telefone preenchido, conta antiga ou autorização
de outro pedido não equivalem a consentimento. Datas e fontes enviadas pelo
navegador são ignoradas. E-mail transacional é independente dessa opção.

Repetir checkout reaproveita o mesmo pedido pendente e atualiza somente a escolha:
adesão repetida preserva a primeira data; desmarcar remove adesão/data/fonte.
Alterar a opção não cria outro Pix/boleto nem outro pedido pagável.

`lib/mibess-notify/customer.ts` monta o snapshot mínimo:

```json
{
  "recipient": {
    "externalId": "artgian:customer:<userId>",
    "name": "Nome do comprador",
    "phone": "+5516997200212",
    "email": "comprador@example.com",
    "whatsappOptIn": true,
    "whatsappOptInAt": "2026-11-16T20:10:00.000Z",
    "whatsappOptInSource": "artgian_checkout_v1"
  },
  "data": {
    "orderUrl": "https://www.artgian.com.br/conta/pedidos/<orderId>"
  }
}
```

Exemplo de contrato, não registro de consentimento real. Nome, e-mail e telefone
vêm do pedido persistido; CPF, endereço e dados de pagamento não são adicionados.
`externalId` usa `artgian:order:<id>` quando a conta foi removida. O telefone é
normalizado para E.164; e-mail/telefone inválidos são omitidos individualmente,
sem impedir a aprovação ou o evento operacional. Sem prova completa de adesão,
`whatsappOptIn=false` e data/fonte são omitidas; o e-mail continua disponível.
O link exige a autenticação e a propriedade do pedido, como a página atual.

O Notify deve aplicar regras `EVENT_RECIPIENT` independentes para WhatsApp Artgian
e e-mail Artgian, preservando as regras `CONTACT` da operação. O remetente
WhatsApp +5516997432741 depende da instância Artgian conectada; esse número era
destinatário do canal Mibess e não se transforma em remetente ao adicionar
`recipient`. Falha de um canal é tratada no Notify, sem repetir a publicação da
Artgian. O e-mail requer o provider SMTP e roteamento por canal no Notify.

`preparing` já é o estado inicial: a confirmação de compra pode informar que o
pedido está em preparação. Não é emitido um segundo evento nessa aprovação.
As etapas pertencem ao pedido inteiro, não a cada item.

### Migração e ativação

1. Publicar primeiro o suporte de e-mail, consentimento e `ORDER_STATUS_CHANGED`
   no Notify, com canais, templates e regras conferidos em homologação.
2. Aplicar a migração aditiva `0024_customer_notifications` após
   `0023_order_item_messages`, com backup/restauração usando:

   ```sh
   node scripts/migrate-store-with-backup.mjs --customer-notify --env=/caminho/seguro.env
   node scripts/migrate-store-with-backup.mjs --customer-notify --env=/caminho/seguro.env --apply
   ```

   O script aceita apenas as três adições revisadas, compara todos os dados das
   colunas antigas dentro do lote SQLite e verifica que pedidos existentes
   começam sem consentimento (`false`, `null`, `null`). O gate de deploy valida
   fisicamente as três colunas. As chaves do backup ficam fora do repositório.
3. Publicar a Artgian mantendo `MIBESS_NOTIFY_CUSTOMER_ENABLED=false`; ativar
   posteriormente no ambiente validado junto de `MIBESS_NOTIFY_ENABLED=true`.

Não há backfill, alteração ou republicação dos snapshots históricos. A flag
controla a criação de novos snapshots; desligá-la não remove destinatários de
eventos que já estão na fila. Para interromper toda publicação, usar a flag
global; entregas já aceitas são operadas no Notify. A fila, QStash, publisher e
chaves idempotentes existentes são compartilhados por todos os canais.

## Configuração e ambientes

Variáveis somente de servidor, descritas em `.env.example`:

```dotenv
MIBESS_NOTIFY_ENABLED=false
MIBESS_NOTIFY_CUSTOMER_ENABLED=false
MIBESS_NOTIFY_BASE_URL=https://notify-hml.mibess.com.br
MIBESS_NOTIFY_API_KEY=
```

- A flag aceita exatamente `true`. Ausente ou desabilitada: não insere eventos
  novos, não publica nem altera pendências existentes. Uma aprovação ocorrida
  desabilitada não é recuperada por repetir seu webhook após ativar. Transições
  futuras são tratadas normalmente. Não há varredura/backfill de pedidos antigos.
- Cada registro fixa `target_origin` ao ser criado. A origem PRD é
  `https://notify.mibess.com.br` somente quando `APP_URL` é HTTPS no host
  `www.artgian.com.br` ou `artgian.com.br` e `VERCEL_ENV` está ausente (CLI) ou
  vale `production`. Local, HML e previews usam `https://notify-hml.mibess.com.br`.
  A URL configurada deve corresponder ao ambiente calculado. Um domínio novo da
  loja exige revisar esta regra explicitamente em `config.ts`.
- `BASE_URL` contém apenas origem HTTPS. Barras finais são normalizadas; caminho
  `/api/v1/events`, query, fragmento, usuário/senha e hosts desconhecidos são recusados.
  Não há fallback para produção. Redirecionamentos HTTP também são recusados.
- Configure API keys ARTGIAN distintas nos ambientes correspondentes. O código
  não pode provar a aplicação associada à chave; confirme isso no painel do Notify.
  Use também bancos e chaves QStash separados para HML e PRD.
- Chave/URL ausente ou incompatível bloqueia o publicador com `configuration_error`,
  sem chamar HTTP nem consumir tentativas. Se a flag estiver ativa, as mudanças
  de negócio continuam registrando a outbox no ambiente correto para recuperação.
- Ao reativar a flag, retomam-se apenas registros pendentes ou leases vencidos
  já registrados legitimamente. Registros `failed` exigem recuperação explícita.

## Migração

`drizzle/0021_mibess_notify_outbox.sql` cria apenas `notify_outbox`, três índices e
um trigger que impede alteração da identidade, destino, payload e datas originais.
O índice único da chave impede duplicação concorrente. A outbox não depende de
uma FK para pedidos: apagar um pedido não pode apagar a identidade de uma
publicação incerta. A migração não insere eventos históricos nem altera pedidos.

O caminho padrão de migração local continua sendo:

```sh
COMMERCIAL_DATABASE_MODE=local DATABASE_URL=file:./data/notify-validation.db pnpm db:migrate
```

Para banco remoto na versão `0020_order_fulfillment`, use o fluxo existente de
backup criptografado, restauração/ensaio local e comparação dos registros:

```sh
node scripts/migrate-store-with-backup.mjs --notify --env=/caminho/seguro.env
node scripts/migrate-store-with-backup.mjs --notify --env=/caminho/seguro.env --apply
node --env-file=/caminho/seguro.env scripts/verify-store-schema.mjs
```

Sem `--apply`, apenas backup e ensaio. O arquivo deve conter as credenciais
válidas do banco correto. A chave do backup fica em `~/.codex/backup-keys/artgian-studio/`,
fora do repositório; preserve-a junto ao arquivo criptografado. Não misture flags
para outras migrações. O verificador de deploy exige a versão, a outbox, os índices
e o trigger. O script é seguro para repetir se a migração já estiver aplicada.
Não publique o código antes da migração no mesmo banco usado pelo deployment.

## Execução recorrente na Vercel

Use um schedule QStash que faz `POST /api/tasks/notify` a cada dois minutos (`*/2 * * * *`, conforme o script atual). Isso aproveita
o provedor já instalado sem depender do worker comercial local, de memória,
`setInterval`, acesso de cliente ou trabalho não aguardado depois da resposta.
Não se usa o Cron diário existente para esta fila.

1. Aplique a migração e publique a rota com a flag ainda desabilitada.
2. Configure no servidor `APP_URL`, o trio `MIBESS_NOTIFY_*` e
   `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` do mesmo ambiente.
3. No terminal operacional, forneça também `QSTASH_TOKEN` e registre o schedule:

```sh
node --env-file=/caminho/seguro.env --conditions=react-server --import tsx scripts/schedule-notify.ts
```

O script valida configuração e usa ID determinístico por `APP_URL`: repetir
atualiza o mesmo schedule. Ele relê destino, periodicidade e pausa para verificar
o resultado. Não cria nenhum evento de negócio. O arquivo precisa conter o
ambiente completo; não se carrega `.env.local` implicitamente. As variáveis já
exportadas no processo têm precedência sobre `--env-file`: use um shell limpo.

4. Confira a chamada no painel QStash. A rota rejeita requisições sem assinatura
   válida do corpo e URL; não existe endpoint público de disparo/reprocessamento.
5. Após validar também os cadastros do Notify, habilite a flag. Monitore o schedule,
   falhas de execução e os registros mais antigos da outbox. A cadência de um minuto
   representa até 1.440 chamadas/dia; confira a capacidade do plano QStash.

Cada chamada aguarda até quatro publicações sequenciais, com timeout de oito
segundos por HTTP (incluindo corpo), orçamento de 35 segundos para iniciar trabalho
e `maxDuration=60`. O próximo minuto escoa pendências restantes. A resposta da rota
resume a execução, sem dados pessoais. Não declara entrega no WhatsApp.

Os scripts npm `notify:outbox` e `notify:schedule` são atalhos quando o ambiente
já está exportado. `server-only` usa a condição `react-server` apenas nas CLIs;
o código de integração continua protegido contra importação no navegador.

## Tentativas, diagnóstico e recuperação

A aquisição ocorre em transação de escrita com atualização atômica, token de
posse aleatório e lease de 60 segundos. Uma queda deixa a linha recuperável após
esse prazo; a conclusão de um worker antigo não pode sobrescrever outro token.
`attempts` conta aquisições acumuladas; `cycle_attempts` permite no máximo dez
por ciclo de recuperação. Até a última tentativa interrompida chega a `failed`
ao vencer o lease. Não é necessário manter um processo em memória.

| Resultado | Ação local |
| --- | --- |
| 202 com UUID, `ACCEPTED` e booleano `duplicate` | `accepted`, salva `notify_event_id`, encerra |
| 202 incompleto, ilegível ou corpo excessivo | `pending`, mesma chave e bytes |
| Timeout/rede, 408, 429 e 5xx | `pending`, backoff exponencial e jitter, respeita `Retry-After` em segundos/data |
| 400 | `failed`, `contract_error` |
| 401 / 403 | `failed`, `credentials_rejected` / `permission_denied` |
| 409 | `failed`, `idempotency_conflict`; nunca troca chave |
| Outros status inesperados não transitórios | `failed`, código HTTP sanitizado |
| Limite de tentativas | `failed`, requer operador |

O backoff começa em 30 segundos, dobra até uma hora de base e recebe jitter
entre 75% e 125%. `Retry-After` pode estender essa espera. HTTP redirects não
repassam a chave para outro destino. Corpos de erro, exceções HTTP, chaves,
CPF, endereço, telefone e payload Mercado Pago nunca entram nos logs do publicador.

```sh
# Lista os 100 registros mais recentes deste ambiente, sem payload/nome/telefone.
node --env-file=/caminho/seguro.env --conditions=react-server --import tsx scripts/notify-outbox.ts list
# Execução manual de um lote, sujeita à flag e mesma configuração do servidor.
node --env-file=/caminho/seguro.env --conditions=react-server --import tsx scripts/notify-outbox.ts run
# Após corrigir a causa, recoloca SOMENTE uma falha deste ambiente na fila.
node --env-file=/caminho/seguro.env --conditions=react-server --import tsx scripts/notify-outbox.ts retry <id-local>
```

A operação CLI exige acesso às credenciais do banco pelo operador. Reprocessar
preserva chave, bytes do payload, destino, `occurredAt`, total de tentativas e
último erro até a tentativa seguinte; apenas reinicia o contador do ciclo e a
data da próxima tentativa. Não opera sobre `accepted` ou sobre outro ambiente.

Use `id`, `idempotencyKey`, `correlationId`, `eventId`, tentativa, estado e erro
sanitizado dos logs para cruzar com o painel do Notify. Em conflito 409, compare o
evento original no painel; não altere snapshot ou chave para mascarar a divergência.
Erros de contrato que exigem mudar o payload imutável demandam investigação e
procedimento explícito separado, não a criação automática de outro evento.
Após `accepted`, acompanhe envio/entrega exclusivamente no Notify. Falha do
WhatsApp nunca cria outra publicação na Artgian.

## Conferência administrativa obrigatória no Notify

Não presumir que o bootstrap deixou recursos ativos. Em cada ambiente, com sessão
administrativa e CSRF apropriados (a API key de eventos não autoriza `/api/v1/admin`):

- Aplicação **ARTGIAN** ativa e API key própria, válida naquele ambiente.
- Contato operacional ativo: **+5516997432741**; é o destinatário, não o remetente.
  Confirmar consentimento, data e fonte reais e ausência de suppression. Não
  preencher consentimento com valores inventados para fazer um teste passar.
- Canal **MIBESS_NOTIFY**, provider **WHATSAPP_EVOLUTION**, ativo, credenciais
  configuradas exclusivamente no Notify e instância realmente conectada.
- Templates revisados e ativos, com status local **APPROVED**. Na Evolution,
  esse status é revisão local e não aprovação da Meta. Template e regra precisam
  apontar para o mesmo canal. `trackingCode` não pode ser obrigatório.
- Regras ativas da aplicação ARTGIAN com `targetType=CONTACT` para o contato acima.
  Reutilizar/ajustar `ARTGIAN_ORDER_PAID` quando cabível, evitando duas regras
  para o mesmo destinatário/evento. Se usar `ARTGIAN_OPERATIONS`, conferir membros
  sem remover participantes de grupo compartilhado inadvertidamente.
- Inspecionar regras `EVENT_RECIPIENT` e outras integrações antes de ativar.
  Esta etapa omite `recipient` e não habilita notificações a compradores.
  Não desabilitar uma regra preexistente sem avaliar seu uso.

Templates sugeridos (a configurar no Notify):

```text
ORDER_PAID
Nova venda Artgian!
Pedido: {{orderNumber}}
Cliente: {{customerName}}
Valor: {{amountFormatted}}
Pagamento: {{paymentMethod}}

TRACKING_POSTED
Pedido Artgian enviado.
Pedido: {{orderNumber}}
Cliente: {{customerName}}

TRACKING_STATUS_CHANGED
Atualização de entrega Artgian.
Pedido: {{orderNumber}}
Cliente: {{customerName}}
Situação: {{statusLabel}}
```

## Validação e arquivos

`tests/mibess-notify.test.ts` cobre o contrato com SQLite isolado e HTTP simulado,
sem cobranças ou mensagens reais: aprovação imediata/webhook/reconciliação
concorrentes, pendência/validação, fluxo antigo, transições/repetições/correções,
rollback, snapshot e restrição única, lease/conclusão atrasada, flag, isolamento,
limites, reprocessamento, respostas e assinatura QStash. Os testes do deploy
verificam a migração e a proteção física de imutabilidade.

Arquivos principais:

- `db/schema.ts`, `drizzle/0021_mibess_notify_outbox.sql`, snapshot/journal: persistência.
- `lib/mibess-notify/{config,customer,outbox,publisher}.ts`: ambiente, destinatário, eventos e publicação.
- `drizzle/0024_customer_notifications.sql`, checkout e schema: adesão por pedido.
- `lib/embedded-payments.ts`, `lib/redirect-payments.ts`, webhook Mercado Pago:
  cobertura dos caminhos de aprovação e repetição das disputas de escrita.
- `lib/order-fulfillment.ts`: eventos das transições já existentes.
- `app/api/tasks/notify/route.ts`, `scripts/{schedule-notify,notify-outbox}.ts`:
  execução autenticada e operação.
- `scripts/{migrate-store-with-backup,verify-store-schema}.mjs`: migração/validação.
- `.env.example`, `package.json`, `pnpm-lock.yaml`, configurações de testes,
  testes da integração/schema e documentação de pagamento/acompanhamento/README.

Validação em 26/09/2026: 364 testes passando em 52 arquivos, TypeScript sem erros,
lint sem erros (18 avisos de imagens preexistentes). Migrações executadas nos
bancos locais isolados de testes e `data/notify-validation.db`.
Build com `pnpm exec next build --webpack` concluído com banco isolado e Notify
desabilitado. O build padrão Turbopack esbarrou na restrição do ambiente à porta
interna do compilador; o padrão do projeto não foi alterado.

Validação da ampliação para compradores em 16/11/2026: 113 testes focados de
checkout, pagamentos, fulfillment, outbox e schema passaram; TypeScript e lint
sem erros (15 avisos de imagens preexistentes). O E2E confirmou opção de WhatsApp
desmarcada e envio explícito de `false`/`true`. Build webpack concluído em cópia
temporária com banco isolado e notificações desabilitadas. O fluxo de migração
0024 também passou pelo backup criptografado, restauração e aplicação atômica
em banco local fictício (somente o diretório da chave foi adaptado nessa cópia).
A suíte completa teve 507 aprovações e uma falha em `openai-draft.test.ts`
(`paused` em vez de `enhanced`), reproduzida em uma cópia limpa de `HEAD` anterior
à mudança; não é regressão destas notificações.

## Configuração de produção — 26/09/2026

Migração 0021 aplicada no Turso `artgian-prod`, com backup criptografado,
restauração/ensaio local e igualdade dos 2.266 registros das 42 tabelas anteriores.
Backup: `backups/store-before-migrations-2026-09-26T11-39-36-791Z.json.aes`;
chave correspondente no diretório de chaves descrito acima. O token de migração
teve validade de uma hora e o arquivo temporário foi removido. O `.env.prod`
antigo não autentica; não o utilize como evidência de configuração do deployment.
A outbox foi conferida vazia após a migração, sem backfill.

Os deploys na Vercel passaram pelo verificador de schema e pelo build padrão
Turbopack. O deployment de ativação `dpl_D19XFXdRYY3eq5ibU8kRxPELNHJf` está READY
e associado a `https://www.artgian.com.br`, com `MIBESS_NOTIFY_ENABLED=true` e o
secret de Production. A chave
própria da aplicação ARTGIAN PRD foi criada no Notify e salva,
com autorização do responsável, como secret `MIBESS_NOTIFY_API_KEY` exclusivamente
em Production do projeto `artgian-studio`. A URL de Production aponta para PRD;
Preview/Development apontam para HML e permanecem desabilitados.

Schedule QStash verificado: `artgian-notify-3209241922dd5f17`, ativo, cron
`* * * * *`, POST `https://www.artgian.com.br/api/tasks/notify`, sem retries de
transporte. Chamadas recorrentes assinadas foram atendidas pelo worker publicado.
Após a ativação, uma chamada operacional assinada em 26/09 às 09:12:24
(America/Sao_Paulo) retornou HTTP 200, `{"status":"completed","processed":0}`,
confirmando configuração válida, acesso à outbox e ausência de pendências naquele
instante. A rota também rejeitou chamada sem assinatura com HTTP 401.
`DELIVERED` no QStash significa entrega da chamada ao worker da Artgian, não
entrega de WhatsApp.

No Notify PRD:

- Aplicação ARTGIAN ativa, chave própria ativa.
- Contato `ARTGIAN_OPERATIONS_CONTACT`, Artgian — Operações, ativo, INTERNAL,
  telefone +5516997432741. Consentimento confirmado expressamente pelo responsável
  nesta tarefa e registrado em 26/09/2026 às 08:45 (America/Sao_Paulo), com fonte
  identificando a confirmação e a finalidade operacional. Lista de supressão
  consultada no painel, sem bloqueios cadastrados.
- Canal MIBESS_NOTIFY ativo, provider WHATSAPP_EVOLUTION, credenciais configuradas.
  As credenciais Evolution permanecem exclusivamente no Notify.
- Templates ativos e localmente APPROVED: `internal_new_order`,
  `artgian_internal_tracking_posted`, `artgian_internal_tracking_status`, todos
  no canal MIBESS_NOTIFY, com os textos e variáveis descritos acima.
- Regras ativas `ARTGIAN_ORDER_PAID`, `ARTGIAN_POSTED_INTERNAL` e
  `ARTGIAN_STATUS_INTERNAL`, respectivamente para os três tipos de evento.
  Todas usam CONTACT apontando somente para Artgian — Operações. A regra existente
  de venda foi ajustada; não foi criada uma segunda regra para o mesmo evento.
- Regras EVENT_RECIPIENT `ARTGIAN_POSTED` e `ARTGIAN_OUT_FOR_DELIVERY` inspecionadas
  e mantidas desativadas. Regras de exceção e teste também permanecem desativadas;
  nenhum grupo compartilhado foi alterado.

### Teste real autorizado — 26/09/2026

Após autorização expressa do responsável, a sessão administrativa já autenticada
do Notify foi utilizada para enviar **uma única mensagem manual** ao contato
Artgian — Operações (+5516997432741), pelo canal MIBESS_NOTIFY. Não foi necessário
obter credenciais Evolution nem autenticar via SSH: o envio real confirmou que
o canal estava conectado e capaz de entregar ao destinatário autorizado.

Texto: “Teste autorizado da Artgian via Mibess Notify. Esta mensagem verifica o
canal de notificações operacionais para este número. Não corresponde a uma venda
ou atualização de pedido real.”

Evidência no histórico do Notify (America/Sao_Paulo):

- 09:10:09: envio manual criado pelo administrador.
- 09:10:10: primeira e única tentativa iniciada.
- 09:10:12: provider aceitou a mensagem (SENT).
- 09:10:15: confirmação do provider **DELIVERED**, exibida como **Entregue**.

O teste não criou pedido, cobrança ou evento de negócio fictício na Artgian.
Testes automatizados permanecem isolados, sem mensagens reais. A entrega acima
valida o caminho manual Notify → Evolution → WhatsApp; a aceitação de um evento
de negócio originado pela outbox deve ser acompanhada na primeira transição real.

## Compradores em produção — 16/11/2026

Código Studio `9e67ad2` e Notify `851dca8773912221e8b1e61273ae5c1f70a2166d`
publicados. O Notify passou pelos pipelines [HML](https://github.com/mibess/mibess-notify/actions/runs/43996978077)
e [PRD](https://github.com/mibess/mibess-notify/actions/runs/43997819300), com aceite
fake completo em HML antes da promoção. A loja publicou primeiro com o envio ao
comprador desabilitado; após o teste real, `MIBESS_NOTIFY_CUSTOMER_ENABLED=true`
foi aplicado em Production. O [deployment de ativação](https://vercel.com/claudemir-custodios-projects/artgian-studio/GdhVSfayP11sUVSazaZ2eZEv8tz4)
(`dpl_GdhVSfayP11sUVSazaZ2eZEv8tz4`) está READY e associado a `www.artgian.com.br`.

A migração aditiva 0024 foi aplicada ao Turso com backup criptografado,
restauração validada e preservação dos 10.519 registros das 50 tabelas anteriores.
Backup: `backups/store-before-migrations-2026-11-17T01-36-49-128Z.json.aes`;
chave fora do repositório em `/Users/mibess/.codex/backup-keys/artgian-studio/`.
Não houve backfill de pedidos ou alteração de eventos históricos.

Configuração dos compradores no Notify:

- Canal WhatsApp `ARTGIAN_CUSTOMERS`, remetente conectado **+5516997432741**.
- Canal SMTP `ARTGIAN_EMAIL`, Zoho com TLS, remetente e Reply-To
  **contato@artgian.com.br**, reutilizando a conta já configurada para a loja.
  Credenciais permanecem criptografadas no Notify, fora do payload dos eventos.
- Quatro regras `ARTGIAN_CUSTOMER_{PAID,STATUS}_{WHATSAPP,EMAIL}` ativas,
  com destino `EVENT_RECIPIENT` na aplicação ARTGIAN. As regras internas existentes
  foram preservadas; os eventos CRM não disparam este fluxo para compradores.
- Confirmação de pagamento, preparação, pronto para envio, postagem, saída para
  entrega e entrega usam a outbox, fila, idempotência e histórico existentes.
  WhatsApp exige a opção explícita do checkout; e-mail funciona independentemente
  dessa opção. Eventos antigos sem destinatário não geram mensagens retroativas.

### Aceite real dos dois canais

Um único evento de compra simulado, `50eab02c-dae6-4108-934b-7e38fb3aeeef`,
passou por ingresso, fila, roteamento e envio do Notify em aplicação temporária
isolada. Não foi criado pedido nem cobrança; o conteúdo identificava o teste.

- WhatsApp `9bd057c6-ee3b-4e58-ae22-0b770290a546`: **DELIVERED** para
  **+5516997200212**, em 16/11/2026 às 22:48:02 (America/Sao_Paulo).
- E-mail `8cb3e9a1-8ade-43b4-8070-904c5df6effc`: **SENT** para
  **c.silverio@live.com**, às 22:48:05. O responsável confirmou o recebimento
  na caixa de entrada. O status técnico continua SENT, pois SMTP não comprova
  entrega na caixa postal por si só.

Ambos tiveram uma tentativa e zero retries. A chave temporária foi revogada,
e a aplicação/regras do teste foram desativadas, preservando o histórico.
O teste real validou o caminho Notify → provedores; checkout → outbox e transições
de pedido foram cobertos pelos testes automatizados descritos acima, sem venda real.
