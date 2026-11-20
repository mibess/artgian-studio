# API de pedidos para o Artgian CRM — v1

API servidor a servidor, somente leitura, para importar pedidos do Artgian Studio. Não altera checkout, pagamento, estoque, entrega ou schema. Usa o banco já selecionado pelo `getDb()` do site; o CRM deve ter banco próprio e importar por esta API. Não use o banco comercial local do site como banco compartilhado do CRM.

A origem é exclusivamente `orders` e `order_items`, do checkout. Os registros de `commercial_orders`, ligados a leads e orçamentos do módulo comercial antigo, não estão incluídos. A importação desse histórico exige conferência de dados demonstrativos, duplicatas e pagamentos: um orçamento confirmado não equivale a um pedido pago.

## Configuração e autenticação

Configure `ARTGIAN_CRM_API_TOKEN` no ambiente do servidor do site e no segredo correspondente do backend do CRM. Gere um segredo aleatório de pelo menos 32 caracteres (por exemplo, 32 bytes aleatórios em hexadecimal). A implementação aceita 32–512 caracteres de token Bearer, com até dois `=` finais. Espaços, valores curtos e configuração ausente deixam a API indisponível (`503`); não existe token padrão.

Envie `Authorization: Bearer <token>`. Cookies, login do cliente, credenciais administrativas e token em query string não autorizam esta API. A comparação utiliza hashes SHA-256 de tamanho fixo e `timingSafeEqual`. A autorização ocorre antes de qualquer acesso ao banco. Não exponha esse segredo em `NEXT_PUBLIC_*`, código do navegador, logs ou arquivos versionados. Use HTTPS no ambiente publicado.

A API não foi publicada nem recebeu segredo por esta implementação. Para ativá-la, configure o ambiente e faça o deploy normal do site.

## Rotas

- `GET /api/integrations/v1/orders`: lista incremental paginada.
- `GET /api/integrations/v1/orders/{id}`: um pedido, retornando `{ "data": { ... } }` ou `404`.

Ambas usam runtime Node.js. Todas as respostas dos handlers, inclusive erros, incluem `Cache-Control: private, no-store, max-age=0` e `Vary: Authorization`. Não há permissão de escrita nem CORS para uso direto no navegador.

### Listagem incremental

| Query | Regra |
| --- | --- |
| `updated_since` | Limite inferior **inclusivo** de `effectiveUpdatedAt`, ISO 8601 com fuso; padrão `1970-01-01T00:00:00.000Z`. |
| `until` | Limite superior **inclusivo**, ISO 8601 com fuso; padrão é o horário UTC do servidor na primeira página. Não pode ser futuro. |
| `limit` | Inteiro entre 1 e 100; padrão 50. Refere-se a pedidos, preservando todos os itens de cada pedido. |
| `cursor` | Cursor opaco assinado recebido na página anterior; mantém janela e limite mesmo quando enviado sozinho. |

Parâmetros desconhecidos, repetidos, datas inválidas, janela invertida e cursor inválido retornam `400`. Não há filtro por status no MVP: importar todas as mudanças evita perder cancelamentos e estornos.

Exemplo de primeira chamada a partir do backend, usando variáveis já configuradas:

```sh
curl --fail-with-body --get \
  --header "Authorization: Bearer ${ARTGIAN_CRM_API_TOKEN}" \
  --data-urlencode 'updated_since=2026-10-01T00:00:00.000Z' \
  --data-urlencode 'limit=50' \
  "${ARTGIAN_STUDIO_BASE_URL}/api/integrations/v1/orders"
```

Envelope:

```json
{
  "data": [],
  "pagination": {
    "limit": 50,
    "hasMore": false,
    "nextCursor": null,
    "updatedSince": "2026-10-01T00:00:00.000Z",
    "until": "2026-10-17T12:00:00.500Z",
    "resumeFrom": "2026-10-17T11:58:00.500Z"
  }
}
```

Enquanto `hasMore` for verdadeiro, solicite `?cursor=<nextCursor>` (codificando o cursor como query string). Se repetir `updated_since`, `until` ou `limit`, seus valores precisam continuar iguais aos da primeira página. A ordem é crescente por `(effectiveUpdatedAt, id)`, usando o ID para desempatar timestamps. Rotacionar o token invalida os cursores antigos; reinicie a janela a partir do último checkpoint persistido.

`effectiveUpdatedAt` é o máximo de `orders.updatedAt`, `fulfillmentUpdatedAt` e `shippingLabelUpdatedAt`, com cada valor normalizado em UTC **antes** de comparar/ordenar. Isso inclui mudanças de entrega que não tocam `orders.updatedAt` e resolve a diferença entre o formato SQLite `YYYY-MM-DD HH:mm:ss` e ISO. Timestamps de saída são ISO UTC com milissegundos; campos opcionais sem timestamp são `null`.

### Checkpoint, consistência e reconciliação

1. Importe os pedidos por upsert com chave única `(source, id)` ou `(conta_da_integração, id)`. Repetir a mesma página deve ser seguro.
2. Percorra todas as páginas com o mesmo cursor/janela. Se houver falha, retome pelo último cursor persistido ou reinicie a janela; não adiante o checkpoint.
3. Somente depois de persistir a última página, grave `pagination.resumeFrom` como o `updated_since` da próxima sincronização. **Não retome diretamente por `until` nem pelo maior timestamp recebido.**
4. Faça reconciliação periódica de todos os pedidos, além do incremental, para corrigir eventual divergência.

`resumeFrom` é `until` menos dois minutos, limitado ao epoch. A sobreposição relê registros intencionalmente: o checkout atual usa `CURRENT_TIMESTAMP` com precisão de segundos e um pedido criado depois de uma página pode ter timestamp anterior ao `until` daquela página. Ela também reduz o risco de commits concorrentes; não garante captura de commits atrasados por mais de dois minutos, relógios divergentes ou timestamps retroativos. A reconciliação continua necessária.

Cada página usa uma única instrução SQL para obter pedidos e itens de forma consistente. A janela fixa limita a busca, mas **não é um snapshot transacional entre páginas**: pedidos podem mudar enquanto o CRM percorre a janela. Uma alteração que passa de `until` será vista numa janela posterior. A API retorna o estado atual do pedido, não um histórico de eventos.

Exclusões físicas não produzem tombstones e não são suportadas pelo incremental. Nunca interprete ausência em uma página como exclusão. Cancelamentos/estornos são importados como mudanças de status. Se exclusões precisarem ser sincronizadas, será necessário adicionar um registro persistente de exclusão/outbox antes de permitir esse fluxo.

## Contrato de cada pedido

| Campo | Significado |
| --- | --- |
| `source`, `id` | `source` fixo `artgian_studio`; ID original e estável do pedido. |
| `status` | Status original do site, predominantemente financeiro: por exemplo `pending`, `paid`, `rejected`, `cancelled`, `refunded`, `charged_back`, `payment_setup_failed`. Preserve valores desconhecidos. |
| `test` | `true` quando o administrador marcou o pedido como teste da loja; `false` nos demais. Marcar ou desmarcar atualiza `effectiveUpdatedAt`, então a mudança chega na próxima sincronização. Não conte pedidos de teste como vendas; o status original é preservado. |
| `payment` | `provider: "mercado_pago"`, `status` original do provedor ou `null`. É separado do status de entrega. |
| `fulfillment` | `status` de preparação/entrega e `updatedAt` opcional. Não deduza entrega concluída a partir de pagamento aprovado. O default `preparing` não significa pagamento aprovado nem autorização para produzir. |
| `customer` | `name`, `email`, `phone`, conforme o pedido. Não contém CPF. |
| `shippingAddress` | `postalCode`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `country: "BR"`. |
| `items` | `id` como string, `productId`, `name`, `color`, `personalization`, `quantity`, `unitPriceCents`, `totalCents`. O total do item é preço unitário × quantidade, antes de desconto/frete do pedido. |
| `totals` | `currency: "BRL"`, `subtotalCents`, `discountCents`, `shippingCents`, `totalCents`. Todos os valores monetários são inteiros em centavos. |
| `shipping` | `provider`, `service`, `company`, `deliveryTimeDays`, `labelStatus`, `trackingCode`, `updatedAt` da etiqueta, permitindo `null`. |
| `createdAt`, `updatedAt`, `effectiveUpdatedAt` | Criação e atualização originais normalizadas, mais timestamp agregado usado na sincronização. |

O mapeamento desses estados originais para estados canônicos é responsabilidade do CRM; esta API não inventa equivalências entre pagamento, produção e entrega.

A projeção SQL e o DTO permitem apenas esses campos. Não exportam CPF, links de checkout/pagamento/etiqueta, tokens, payloads brutos, IDs de pagamento, erros de etiqueta, observações internas ou snapshots de embalagem. Dados de contato, endereço e personalização continuam sendo dados pessoais e devem ficar restritos aos operadores autorizados do CRM.

`paymentAttempts` não faz parte deste contrato. Tentativas pendentes/incertas podem mudar sem atualizar o pedido; esta API mostra o estado consolidado de `orders`, não a atividade de tentativas. Os itens são os snapshots atuais do pedido: se surgir edição direta de itens no futuro, essa escrita deverá atualizar um dos timestamps rastreados para participar do incremental.

## Erros e limites operacionais

- `400`: parâmetros, cursor ou ID inválidos.
- `401`: Bearer ausente/incorreto, com `WWW-Authenticate`.
- `404`: pedido inexistente na consulta individual.
- `503`: segredo de integração ausente ou inválido.
- `500`: falha interna, com mensagem genérica sem detalhes do banco.

A normalização usa expressão SQL sem índice dedicado. É adequada ao MVP de aproximadamente dez pedidos/mês; medir antes de ampliar histórico/volume. Não foram adicionadas dependências, migrations, webhook ou worker permanente. Para o CRM, sincronização agendada curta e botão de sincronização manual bastam nesta fase.

## Verificação local

```sh
pnpm exec vitest run tests/orders-integration.test.ts
pnpm typecheck
pnpm exec eslint lib/orders-integration.ts tests/orders-integration.test.ts app/api/integrations/v1/orders/route.ts 'app/api/integrations/v1/orders/[id]/route.ts'
```

Os testes usam SQLite temporário, dados fictícios e credenciais fictícias. Cobrem autorização antes do banco, fechamento com configuração inválida, contrato e omissões, erros, normalização de datas, empates, limite aplicado antes dos itens, alteração apenas de entrega/etiqueta, cursor assinado, janela fixa, sobreposição de retomada e filtros inválidos.
