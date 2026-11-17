# Mensagens por produto comprado

O cliente encontra **Falar com o vendedor** em cada item de `/conta` e no resumo do acompanhamento do pedido. A conversa identifica o pedido, o nome do produto, a cor e a personalização registrados na compra. O mesmo produto comprado novamente tem outra conversa, e itens removidos do catálogo continuam acessíveis pelo histórico do pedido.

A equipe atende em `/admin/mensagens`. A caixa mostra o cliente, o produto, a última mensagem e a quantidade de mensagens ainda não lidas. Há também acesso pela lista de pedidos do admin. As mensagens de compras ficam no banco da loja, separado das conversas de Instagram do CRM.

## Publicação em produção

Publicado em **16/11/2026 (America/Sao_Paulo)**, após autorização do responsável, em https://www.artgian.com.br/conta. Atendimento do vendedor em https://www.artgian.com.br/admin/mensagens.

- Migração `0023_order_item_messages` aplicada atomicamente no `artgian-prod`, com backup criptografado, ensaio de restauração, comparação dos dados existentes e validação de integridade. Snapshot: 49 tabelas e 10.481 registros.
- Backup: `backups/store-before-migrations-2026-11-17T00-26-12-690Z.json.aes`. Chave de recuperação: `/Users/mibess/.codex/backup-keys/artgian-studio/store-before-migrations-2026-11-17T00-26-12-690Z.key`. Os nomes dos arquivos usam UTC.
- Deployment: `dpl_A37SdERZPorxFibGgq6hr1DHNgLx`, https://artgian-studio-5l721u4gj-claudemir-custodios-projects.vercel.app. A Vercel validou o schema, compilou com Turbopack e concluiu a verificação TypeScript. O deployment foi testado antes da promoção e confirmado no domínio público.
- Referência para rollback do aplicativo: `dpl_3tfHAiHCE8sj7oPejGeiSqArk8QA`. A migração aditiva permanece compatível com essa versão anterior.
- Verificações de produção, somente leitura: catálogo, login obrigatório na conta, caixa do vendedor, links por item, tela e formulário da conversa, histórico via API, rejeição de acessos anônimos e resposta 404 para item inexistente. Nenhuma mensagem de teste foi enviada a clientes.

O pacote de publicação exclui também `.agents/`, `.codex/`, `.openai/` e `outputs/`, além das exclusões existentes de segredos, backups e bancos locais.

## Funcionamento

- Cada conversa pertence a um `order_items.id` e só pode ser consultada pelo titular do pedido ou por uma sessão administrativa válida.
- Pedidos pendentes, cancelados e reembolsados também permitem contato para tratar dúvidas sobre pagamento ou pós-venda.
- As mensagens aceitam texto de até 2.000 caracteres. O histórico é salvo e carrega as últimas 50 mensagens, com acesso às anteriores.
- A conversa aberta consulta novas mensagens a cada cinco segundos enquanto a página estiver visível. Ao visualizar mensagens recebidas, o cliente ou vendedor registra a leitura até a última mensagem exibida.
- O formulário preserva o texto em caso de falha no envio. Tentativas repetidas da mesma mensagem usam o mesmo identificador para evitar duplicações quando a resposta da rede se perde.
- Os avisos de novas mensagens aparecem na conta e na caixa administrativa. Esta versão não envia notificações por e-mail, WhatsApp ou Instagram.

## Rotas e armazenamento

| Uso | Rota |
| --- | --- |
| Conversa do cliente | `/conta/pedidos/[id]/itens/[itemId]/mensagens` |
| Caixa do vendedor | `/admin/mensagens` |
| Conversa do vendedor | `/admin/mensagens/[orderId]/[itemId]` |
| API do cliente | `/api/orders/[id]/items/[itemId]/messages` |
| API do vendedor | `/api/admin/orders/[id]/items/[itemId]/messages` |

As APIs retornam `Cache-Control: private, no-store`. O servidor valida a sessão e a relação entre pedido e item em cada requisição. Escritas exigem a mesma origem; o remetente é determinado pela autenticação, nunca pelo corpo enviado pelo navegador.

A tabela `order_item_messages` usa uma referência com exclusão em cascata para o item. O índice único `(order_item_id, sender, client_id)` garante a idempotência; os índices de histórico e mensagens não lidas sustentam a conversa e os indicadores.

## Preparação para publicar

O banco SQLite local recebe a migração `0023_order_item_messages` ao inicializar. A migração já está aplicada no Turso de produção. Em outros ambientes, aplique-a **antes** da publicação do código; o build verifica o histórico de migrações, a tabela, as colunas, os índices e a referência ao item.

Com o banco na migração `0022_omniscient_azazel`, faça o ensaio usando as credenciais do ambiente autorizado:

```sh
node scripts/migrate-store-with-backup.mjs --runtime-env --chat
```

O ensaio cria um backup criptografado, mantém a chave fora do repositório, restaura o snapshot localmente e valida a migração. Para aplicar no ambiente escolhido:

```sh
node scripts/migrate-store-with-backup.mjs --runtime-env --chat --apply
node scripts/verify-store-schema.mjs
```

O modo `--chat` aceita somente a migração aditiva esperada. A aplicação verifica o estado inicial, preserva os registros existentes e verifica a integridade dentro da mesma operação atômica. Se o banco já estiver atualizado, apenas confere o schema. Também é possível usar `--env=/caminho/seguro.env` no lugar de `--runtime-env`.

## Verificação

```sh
pnpm exec vitest run tests/order-messages.test.ts tests/deployment-schema.test.ts
pnpm exec playwright test tests/e2e/order-messages.spec.ts
```

Os testes usam bancos isolados e cobrem a troca entre cliente e vendedor, persistência, indicadores de leitura, isolamento entre itens e contas, autenticação e repetição de envio após uma resposta de rede perdida. Nenhum teste envia mensagens a serviços externos.
