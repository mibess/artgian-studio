# Acompanhamento manual de pedidos

O cliente encontra **Acompanhar pedido** na confirmação de pagamento e em
**Minha conta → Meus pedidos**, após o pagamento ser aprovado. A página
`/conta/pedidos/[id]` exige login e pertence exclusivamente ao comprador.

## Atualizar pelo administrador

1. Acesse **Admin → Pedidos e entregas** (`/admin/pedidos`). A página abre na fila
   **A enviar**: pedidos pagos em preparação ou prontos para envio, dos mais antigos
   para os mais recentes. As outras filas são **Em trânsito**, **Entregues**,
   **Aguardando pagamento**, **Cancelados** e **Todos**, cada uma com seu contador.
2. Clique no pedido. Os detalhes abrem ao lado da lista no computador e em tela
   cheia no celular, sem perder a posição na lista. A busca encontra nome, e-mail,
   número do pedido, código de rastreio, CPF, telefone ou CEP.
3. Em **Andamento da entrega**, o botão principal leva o pedido à próxima etapa:
   **Em preparação → Pronto para envio → Enviado → Saiu para entrega → Entregue**.
   Para pular ou corrigir uma etapa, use **Escolher outra etapa**.
4. Opcionalmente, preencha o código de rastreio (a partir de **Enviado**) e uma
   mensagem para o cliente, e confirme.
5. Em **Etiqueta de envio**, siga os passos **Comprar → Gerar PDF → Imprimir**.
   A compra pede confirmação antes de ser feita na transportadora.

A alteração aparece quando o cliente abre ou atualiza o acompanhamento.
Atalhos no computador: **J** e **K** passam ao próximo pedido ou ao anterior,
**/** vai para a busca e **Esc** fecha o pedido aberto.
Cada alteração registra data, etapa, observação e código no histórico.
A observação é pública para o comprador; evite informações internas.
É possível corrigir uma etapa sem apagar o histórico anterior. Uma aba
administrativa desatualizada exige recarregar antes de salvar outra alteração.

Pedidos pagos começam em **Em preparação**, inclusive os anteriores à publicação.
O administrador deve ajustar manualmente os pedidos antigos que já avançaram.
Pedidos sem pagamento aprovado não mostram progresso de entrega e não aceitam
essas atualizações. O status da entrega não altera o pagamento nem os valores.

O rastreio funciona também para entregas locais sem código. Não há consulta
automática à transportadora nem mudança de etapa ao gerar etiquetas.
Com a [integração Mibess Notify](mibess-notify.md) habilitada, as transições para
Enviado, Saiu para entrega e Entregue geram eventos internos transacionais.
Alterar apenas observação/rastreio não gera notificação. Com a flag adicional
`MIBESS_NOTIFY_CUSTOMER_ENABLED`, os mesmos eventos incluem o comprador para
e-mail e WhatsApp (este exige a adesão opcional registrada no checkout); mudanças
para Em preparação e Pronto para envio também publicam eventos. A ativação exige
os canais/regras do Notify e a migração 0024 descritos na documentação da integração.
O botão **Atualizar acompanhamento** busca a informação salva pela equipe.

## Pedidos de teste

Pedidos feitos só para testar a loja podem ser marcados no painel do pedido, em
**Marcar como teste** (no fim do painel, com confirmação). O pedido marcado:

- sai das filas **A enviar**, **Em trânsito**, **Entregues**, **Aguardando pagamento**,
  **Cancelados** e **Todos**, e dos contadores; aparece só na fila **Testes**, que
  surge quando há ao menos um teste;
- não permite comprar ou gerar etiqueta nem atualizar a entrega, o que também
  evita avisos ao cliente;
- continua inteiro no banco, com itens, mensagens e histórico, e segue visível
  para o cliente em **Minha conta**;
- chega à API do CRM com `test: true`.

**Não é teste: desmarcar** devolve o pedido à fila correspondente. Para não
criar novos testes em produção, teste no preview local ou em um deploy de
Preview com Mercado Pago e frete em modo sandbox e banco separado.

A coluna `test_marked_at` vem da migração aditiva `0025_test_orders.sql`. Ela
precisa estar no banco de produção **antes** do deploy, porque o build recusa
publicar com o banco desatualizado:

```sh
node scripts/migrate-store-with-backup.mjs --test-orders --env=/caminho/seguro.env
node scripts/migrate-store-with-backup.mjs --test-orders --env=/caminho/seguro.env --apply
```

A primeira execução faz o backup criptografado, restaura e ensaia a migração
localmente sem alterar o banco remoto; a segunda aplica. O script só aceita
adicionar essa coluna, confere que nenhum pedido começa marcado e que todos os
dados anteriores continuam iguais.

## Banco e publicação

A migração aditiva `0020_order_fulfillment.sql` adiciona a etapa atual, observação,
data e revisão ao pedido, além da tabela `order_fulfillment_events` com histórico.
O código de rastreio usa o campo já existente `shipping_tracking_code`.

Antes de publicar, use um arquivo temporário protegido contendo
`TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` do ambiente correto:

```sh
node scripts/migrate-store-with-backup.mjs --fulfillment --env=/caminho/seguro.env --apply
```

O script exige a migração anterior `0019_sparkling_dust`, cria backup criptografado,
testa sua restauração local e a migração, e preserva os registros existentes em
uma transação. As chaves de recuperação ficam fora do repositório. O build
verifica a migração e a estrutura esperada antes da publicação.

## Verificação

```sh
pnpm exec vitest run tests/order-fulfillment.test.ts tests/deployment-schema.test.ts tests/cart.test.ts
pnpm exec playwright test tests/e2e/order-tracking.spec.ts
```

Os testes usam bancos locais isolados, clientes e pedidos fictícios; não geram
cobranças, não compram etiquetas e não alteram pedidos reais.
