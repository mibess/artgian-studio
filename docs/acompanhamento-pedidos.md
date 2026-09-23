# Acompanhamento manual de pedidos

O cliente encontra **Acompanhar pedido** na confirmação de pagamento e em
**Minha conta → Meus pedidos**, após o pagamento ser aprovado. A página
`/conta/pedidos/[id]` exige login e pertence exclusivamente ao comprador.

## Atualizar pelo administrador

1. Acesse **Admin → Pedidos e entregas** (`/admin/pedidos`).
2. Localize um pedido com pagamento aprovado.
3. Em **Acompanhamento da entrega**, selecione a etapa:
   **Em preparação → Pronto para envio → Enviado → Saiu para entrega → Entregue**.
4. Opcionalmente, preencha o código de rastreio e uma observação para o cliente.
5. Clique em **Atualizar acompanhamento**.

A alteração aparece quando o cliente abre ou atualiza o acompanhamento.
Use **Pedidos anteriores** no final da lista para acessar as páginas seguintes.
Cada alteração registra data, etapa, observação e código no histórico.
A observação é pública para o comprador; evite informações internas.
É possível corrigir uma etapa sem apagar o histórico anterior. Uma aba
administrativa desatualizada exige recarregar antes de salvar outra alteração.

Pedidos pagos começam em **Em preparação**, inclusive os anteriores à publicação.
O administrador deve ajustar manualmente os pedidos antigos que já avançaram.
Pedidos sem pagamento aprovado não mostram progresso de entrega e não aceitam
essas atualizações. O status da entrega não altera o pagamento nem os valores.

O rastreio funciona também para entregas locais sem código. Não há consulta
automática à transportadora, envio de notificações ou mudança de etapa ao gerar
etiquetas. O botão **Atualizar acompanhamento** busca a informação salva pela equipe.

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
