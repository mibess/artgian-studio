# Pagamento no site

O checkout oferece cartão, Pix e boleto em `/comprar/pagamento?pedido=...`, com o
layout da Artgian. A criação da cobrança usa a API Payments do Mercado Pago,
compatível com a integração existente de notificações `payment`. Cartões usam
CardForm com `iframe: true`: número, validade e CVV vão diretamente ao Mercado
Pago. A aplicação recebe apenas o token do cartão. Conta Mercado Pago e Linha
de Crédito não são oferecidas nesta interface.

## Configuração e publicação

- No painel da aplicação, selecionar **Checkout Transparente → API Pagamentos**.
  Essa seleção disponibiliza o par `TEST-...` usado na homologação desta API.
  As credenciais `APP_USR-...` da conta de teste criada pelo Checkout Pro não são
  equivalentes: a API Payments pode recusá-las com HTTP 401, código 7.
- Adicionar `MERCADO_PAGO_PUBLIC_KEY` ao ambiente local e à Vercel. Usar a chave
  pública da **mesma aplicação e ambiente** do `MERCADO_PAGO_ACCESS_TOKEN`.
  A Public Key é enviada ao navegador; o Access Token permanece no servidor.
- Manter `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_ENVIRONMENT` e `APP_URL`.
  `APP_URL` deve ser a origem pública HTTPS da loja. Em produção, usar
  `MERCADO_PAGO_ENVIRONMENT=production` para exigir a assinatura das notificações.
- Cadastrar a notificação de pagamentos em
  `https://SEU-DOMINIO/api/mercado-pago/webhook`. O endereço também é enviado ao
  criar cada cobrança. A conta recebedora precisa ter Pix habilitado.
- Aplicar `drizzle/0019_sparkling_dust.sql` ao banco do ambiente de publicação.
  Ela adiciona duas colunas a `orders`, cria `payment_attempts` e seus índices,
  preservando os pedidos antigos. Para bancos na migração 0018, executar
  `node scripts/migrate-store-with-backup.mjs --payments --env=/caminho/seguro.env --apply`.
  O script cria um backup criptografado, verifica sua restauração, ensaia a
  migração localmente e só então aplica a alteração em uma transação. Confere
  todos os dados anteriores e a integridade antes de confirmar. Sem `--apply`,
  realiza apenas o backup e o ensaio. A chave de recuperação fica fora do
  repositório, no caminho informado na saída; preserve-a junto ao backup.
- Executar `node scripts/verify-store-schema.mjs` com as credenciais do mesmo
  ambiente. A publicação da Vercel já executa essa verificação e bloqueia bancos
  sem a tabela/colunas novas. `--apply-contact` não aplica a migração de pagamento.
- Homologar cartão aprovado/recusado e 3DS, Pix e boleto com as credenciais de
  teste do Mercado Pago antes de ativar as credenciais de produção.

Os testes automatizados usam dados fictícios e o SDK/API simulados. Eles não
substituem essa homologação e não efetuam pagamentos reais.

### Homologação realizada em 23/09/2026

Com o SDK real, as credenciais `TEST-...` da aplicação e banco local isolado:

- Cartão: aprovação (`APRO`) e recusa por limite (`FUND`), com a resposta
  correspondente apresentada dentro do site.
- Pix: emissão do QR Code, Copia e Cola e prazo de validade retornados pela API.
- Boleto: emissão do código de barras, link do documento e vencimento;
  os mesmos dados foram preservados após recarregar a página.
- Os campos seguros, banco emissor e opções de parcelamento carregaram pelo SDK.

Pix e boleto foram validados até a emissão; não houve pagamento bancário real.
O desafio 3DS, as notificações assinadas, a confirmação posterior e a recuperação
após falha de conexão também estão cobertos pelos testes automatizados com
respostas simuladas. A homologação local não publica código nem migra o banco
de produção.

### Migração de produção em 23/09/2026

A migração 0019 foi aplicada ao banco `artgian-prod`, com backup criptografado
das 40 tabelas e 2.068 registros anteriores. A restauração e o ensaio local
passaram; a transação remota confirmou a preservação dos registros e a
integridade do banco. A verificação independente do schema também passou.
O arquivo está em `backups/store-before-migrations-2026-09-23T19-27-50-466Z.json.aes`;
a chave correspondente está em `~/.codex/backup-keys/artgian-studio/`, fora do
repositório. Nenhum desses arquivos é enviado ao Git ou à Vercel.

### Identificador de segurança do SDK

O SDK real gera `MP_DEVICE_SESSION_ID` com segmentos separados por pontos.
Esse identificador é enviado sem alterações em `X-meli-session-id`. A validação
aceita os pontos e mantém o limite de tamanho e a rejeição de espaços/quebras de
linha. Uma regra que aceitava somente letras, números, hífen e sublinhado foi
corrigida após bloquear submissões em produção antes da criação da cobrança.
Há regressões na API para cartão, Pix e boleto, além da simulação no navegador.
Erros de validação registram apenas nomes conhecidos dos campos e códigos de
erro, sem os valores enviados, e retornam orientações específicas para sessão,
CPF, emissor e parcelamento.

## Fluxo e recuperação

1. `/api/checkout` recebe `checkoutMode: "embedded"`, valida catálogo, entrega e
   cupom, salva o pedido e retorna a URL interna. Sem a chave pública, responde
   indisponibilidade antes de reservar o pedido/cupom. Clientes antigos, que não
   enviam esse campo, continuam compatíveis com Checkout Pro; links já emitidos
   e seus webhooks continuam funcionando.
2. `POST /api/checkout/:id/payment` aceita somente os campos previstos para
   cartão, Pix ou boleto. Total, comprador, endereço e referência vêm do pedido
   persistido. Sessão e propriedade do pedido são exigidas em todas as consultas
   e alterações do checkout integrado.
3. A transação local permite apenas uma tentativa ativa por pedido. Uma nova
   tentativa só pode começar depois de uma falha definitiva, recusa ou
   cancelamento. Uma requisição repetida mantém a mesma chave de idempotência.
4. Se a conexão com o provedor falhar após o envio, a tentativa fica em
   verificação. A consulta reconcilia por ID/referência; “Verificar pagamento”
   pode reenviar **o mesmo corpo e a mesma chave**, sem criar uma cobrança nova.
   O corpo é uma lista controlada de campos, contendo apenas o token do cartão,
   nunca os dados sensíveis. É descartado após receber a resposta identificada.
   A repetição automática pelo botão é limitada a 23 horas; uma tentativa ainda
   incerta depois desse prazo precisa ser conferida na conta do Mercado Pago.
5. O webhook assinado e a consulta autenticada à API confirmam valor, moeda,
   pedido e tentativa. A comparação usa o principal, sem confundir juros do
   parcelamento com o valor do pedido. Eventos atrasados não desfazem pagamentos
   já confirmados. Cupons do jogo são consumidos uma única vez na aprovação.
6. A página mostra QR Code/Copia e Cola, código e documento do boleto, ou o
   desafio 3DS do banco dentro de um iframe. Ela consulta o estado a cada 10
   segundos enquanto estiver visível. As consultas ao provedor são limitadas
   no servidor. O cliente pode retomar o pagamento em **Minha conta**.

O prazo para iniciar uma cobrança é de até 24 horas e respeita a expiração do
cupom. Pix/boletos já emitidos usam o vencimento retornado pelo Mercado Pago e
podem ser confirmados depois desse prazo. Nunca se libera uma nova cobrança
enquanto a anterior está pendente ou incerta.

## Referências oficiais

- [Identificador de segurança do dispositivo](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/how-tos/improve-payment-approval/recommendations)
- [CardForm e captura segura](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/card/integrate-via-cardform/introduction)
- [API do SDK CardForm](https://github.com/mercadopago/sdk-js/blob/main/docs/card-form.md)
- [Estilos dos campos seguros](https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md)
- [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix)
- [Boleto](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/other-payment-methods)
- [Autenticação 3DS](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/how-tos/integrate-3ds)
