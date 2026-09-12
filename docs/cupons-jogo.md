# Cupons e integração do jogo

## Rotas

- Loja de produção: `https://www.artgian.com.br`.
- Geração: `POST https://www.artgian.com.br/api/coupons/game`.
- Painel: `https://www.artgian.com.br/admin/descontos` (autenticação do admin).
- Desenvolvimento: mesmas rotas em `http://localhost:3000`.

As rotas de produção ficam disponíveis **depois da publicação desta implementação,
da migração e da configuração da chave**. Alterar o código local não publica o site.

## Configuração da loja

1. Aplicar a migração aditiva `drizzle/0015_gray_manta.sql` antes de publicar.
   O SQLite local migra automaticamente na primeira conexão. Para o Turso,
   executar o comando de migração com as credenciais do banco de destino no ambiente:

   ```bash
   COMMERCIAL_DATABASE_MODE=turso pnpm db:migrate
   ```

2. Gerar uma chave com `openssl rand -hex 32`. Salvar como `COUPON_GAME_API_KEY`
   na loja e no servidor do jogo, com o mesmo valor. São exigidos pelo menos
   32 caracteres. Não colocar a chave no código, no navegador ou em variáveis
   `NEXT_PUBLIC_*`. A API retorna 503 enquanto a chave não estiver configurada.
3. Opcionalmente configurar `COUPON_GAME_HOURLY_LIMIT` (padrão 100) e
   `COUPON_GAME_PLAYER_HOURLY_LIMIT` (padrão 3). Os limites são por hora UTC,
   persistidos no banco e compartilhados entre instâncias da loja.
4. Manter `APP_URL`, Mercado Pago e webhook configurados conforme o checkout
   existente. Homologar um pagamento com cupom no ambiente de teste do Mercado Pago.

## Contrato

A chamada deve partir do **backend do jogo**, depois de verificar que a fase foi
concluída legitimamente. O navegador chama uma rota do próprio jogo; essa rota
valida a sessão e a conclusão antes de falar com a loja. Não há CORS público.
Chamadas com `Origin` são rejeitadas para impedir o uso direto no frontend.

```bash
curl --fail-with-body --request POST \
  'https://www.artgian.com.br/api/coupons/game' \
  --header "Authorization: Bearer $COUPON_GAME_API_KEY" \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: conclusao-550e8400-e29b-41d4-a716-446655440000' \
  --data '{"playerId":"jogador-123","completionId":"partida-456-fase-3"}'
```

`playerId` é o identificador estável do jogador autenticado, definido pelo
backend, sem CPF/e-mail. `completionId` identifica uma conclusão real e única,
também validada pelo backend. Ambos são strings de 1 a 128 caracteres; campos
extras são rejeitados. Identificadores são armazenados na loja como hashes.
O identificador do jogador serve ao limite de emissão; o código emitido é um
cupom ao portador, sem vínculo obrigatório com uma conta da loja.

`Idempotency-Key` aceita de 8 a 128 letras, números, hífen ou sublinhado. Gere
uma chave uma única vez por conclusão, persista-a e repita **a mesma chave e o
mesmo corpo** em todas as tentativas. Trocar de chave para uma conclusão já
registrada retorna 409. A mesma chave com outro corpo também retorna 409.

Resposta 201 (exemplo; o código e o percentual são sorteados):

```json
{
  "code": "GAME-0123456789ABCDEF0123",
  "discountPercent": 15,
  "expiresAt": "2026-09-10T18:30:00.000Z",
  "expiresInSeconds": 1799,
  "reusable": false
}
```

As opções usam um gerador criptográfico e têm raridade crescente: 5% de desconto
tem 40% de chance, 10% tem 30%, 15% tem 20% e 30% tem 10% de chance.
A validade começa na emissão e dura exatamente 30 minutos. Uma repetição
válida retorna 200, com o mesmo código e expiração, sem novo sorteio ou consumo
de limite. `expiresInSeconds` é o tempo restante no momento da resposta.

| Status | Tratamento no jogo |
| --- | --- |
| 200 / 201 | Mostrar percentual, código copiável e contagem regressiva. |
| 400 | Corrigir corpo/chave/JSON; não repetir automaticamente. |
| 401 | Corrigir a chave secreta no servidor. |
| 403 | Fazer a chamada pelo backend, sem `Origin`. |
| 409 | Conclusão/chave já registrada; reutilizar a chave original. |
| 410 | Recompensa expirada, excluída, usada ou reservada; não sortear novamente. |
| 413 | Corpo excede 4096 caracteres. |
| 429 | Respeitar `Retry-After` (segundos); não trocar jogador/chave para contornar. |
| 500 / 503 | Indisponibilidade/configuração; repetir com a mesma chave e espera progressiva. |

Os erros têm o formato `{ "error": "mensagem em português" }`. Respostas de
sucesso e erros de domínio usam `Cache-Control: no-store`.

## Uso, exclusão e pagamentos

- O cliente entra na loja, seleciona os produtos e aplica o código no checkout.
  A prévia usa os preços atuais do catálogo. A confirmação revalida tudo no servidor.
- Um cupom por pedido, sem acumular códigos. O desconto incide somente nos produtos,
  nunca no frete; percentuais arredondam para baixo em centavos. Cupons do jogo
  exigem pelo menos R$ 100,00 em produtos. Todo desconto, fixo ou percentual, fica
  limitado ao subtotal, ao teto global de R$ 100,00 e a qualquer teto menor
  configurado no admin.
- Ao criar o pedido, uma transação reserva o uso e grava os itens e o desconto.
  Duas compras simultâneas não conseguem reservar o último uso.
- A reserva mantém o cupom indisponível durante o pagamento. Quando há uma data
  de expiração, ela também é enviada à preferência do Mercado Pago. Um pagamento
  iniciado dentro do prazo pode ter confirmação posterior (por exemplo, Pix).
- A aprovação autenticada e com valor correspondente ao pedido exclui o cupom
  do jogo. Notificações repetidas não repetem a baixa. O pedido conserva código,
  tipo, valor e desconto em centavos para auditoria, mesmo após excluir o cupom.
- Cupons manuais permanecem no painel, com o limite de usos respeitado. O contador
  inclui pedidos reservados. Sem reutilização, o limite é um pedido; reutilizáveis
  podem ter limite total ou usos ilimitados. Alterações não afetam pedidos iniciados.
- Cupons expirados do jogo ficam inválidos imediatamente, independentemente da
  limpeza. São removidos na próxima chamada autenticada de geração ou pelo botão
  “Excluir expirados do jogo” no admin. O registro da conclusão permanece para
  impedir reemissão mesmo após a exclusão; não contém o identificador em texto puro.
- Uma rejeição definitiva ao criar a preferência libera a reserva. Timeout,
  falha de rede ou erro ambíguo mantêm a reserva, pois pode existir um pagamento
  externo válido. Não liberar automaticamente em rejeição/cancelamento de uma
  tentativa: a mesma preferência pode permitir outra tentativa ou ter confirmação
  tardia. Reservas ambíguas exigem conciliação operacional; não há liberação por prazo.
- O cliente pode retomar uma preferência salva em “Minha conta → Continuar pagamento”.
  Estorno não recria cupons usados. Exclusão manual impede novas reservas, preservando
  pagamentos já iniciados.
- Desconto de 100% continua cobrando o frete: o Mercado Pago recebe apenas a entrega
  como item cobrável; o pedido mantém todos os produtos e os valores originais.

## Prompt pronto para a IA do jogo

> Implemente a recompensa de cupom ao concluir uma fase. No backend do jogo,
> valide a sessão e a conclusão real antes de chamar POST
> https://www.artgian.com.br/api/coupons/game. Leia COUPON_GAME_API_KEY de uma
> variável secreta do servidor e envie Authorization: Bearer <chave>,
> Content-Type: application/json e Idempotency-Key com uma chave persistida por
> conclusão. Envie {playerId, completionId}, identificadores estáveis definidos
> e validados no servidor. Nunca exponha a chave ao navegador nem confie apenas
> em um evento enviado pelo cliente para provar a vitória. Em timeout/5xx,
> repita com a mesma chave e o mesmo corpo, usando espera progressiva. Em 200/201,
> mostre code, discountPercent, botão Copiar cupom, contagem regressiva baseada
> em expiresAt/expiresInSeconds e botão Visitar loja para
> https://www.artgian.com.br/produtos. Informe que o cupom é de uso único,
> vale por 30 minutos e não desconta o frete. Guarde a recompensa da conclusão
> para não gerar novamente ao recarregar. Respeite Retry-After em 429. Em 410,
> informe que a recompensa não está mais disponível e não gere outra. Não faça
> chamada direta do navegador à loja. O contrato completo está em
> docs/cupons-jogo.md no projeto Artgian Studio. A rota de produção depende da
> publicação e da configuração da chave na loja.

Referência do provedor usada para a vigência da preferência e itens:
[Preferências do Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/checkout-customization/preferences).
