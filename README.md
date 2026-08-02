# Artgian Studio

Loja da Artgian Studio desenvolvida com Next.js (App Router), React e
TypeScript.

## Requisitos

- Node.js 22
- npm

## Desenvolvimento

Instale as dependências e inicie o servidor local:

```bash
npm ci
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Comandos

- `npm run dev`: inicia o Next.js em modo de desenvolvimento
- `npm run build`: gera a versão de produção
- `npm run start`: executa a versão de produção
- `npm run lint`: verifica a qualidade do código
- `npm test`: executa lint e build
- `npm run db:generate`: gera migrações do Drizzle

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha as credenciais necessárias.

O checkout usa o Mercado Pago Checkout Pro. Em produção, configure a URL do
webhook como:

```text
https://seu-dominio.com/api/mercado-pago/webhook
```

O banco usa Turso/libSQL. Configure `TURSO_DATABASE_URL` e
`TURSO_AUTH_TOKEN`, e aplique a migração disponível em `drizzle/` antes de
testar o checkout.

Tokens e segredos são usados apenas no servidor e não devem receber o prefixo
`NEXT_PUBLIC_`.

## Frete com Melhor Envio

O checkout consulta a API v2 do Melhor Envio no servidor. Configure em
`.env.local`:

```text
MELHOR_ENVIO_ENVIRONMENT=sandbox
MELHOR_ENVIO_ACCESS_TOKEN=seu-token
MELHOR_ENVIO_ORIGIN_POSTAL_CODE=00000000
MELHOR_ENVIO_USER_AGENT=Artgian Studio (email@dominio.com)
```

Sandbox e produção usam contas e tokens diferentes. Mantenha `sandbox` durante
os testes e troque para `production` somente depois de validar a integração.

Também é obrigatório preencher `shippingPackage` de cada produto em
`lib/catalog.ts` com largura, altura e comprimento da embalagem em centímetros
e o peso embalado em quilogramas. Exemplo:

```ts
shippingPackage: {
  widthCm: 20,
  heightCm: 10,
  lengthCm: 30,
  weightKg: 0.5,
},
```

Sem esses dados o checkout recusa a cotação para evitar cobranças de diferença
por peso ou dimensões incorretos.

Antes de testar pedidos, aplique também a migração mais recente da pasta
`drizzle/` no banco Turso.

### Etiquetas sandbox

A compra e a geração manual de etiquetas ficam em `/admin/pedidos`. Essa área
usa autenticação HTTP Basic e exige `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

Os dados privados do remetente são lidos das variáveis
`MELHOR_ENVIO_SENDER_*` documentadas em `.env.example`. CPF e telefone devem
conter apenas números. O checkout também solicita e valida o CPF do comprador,
necessário para gerar a etiqueta.

Por segurança, `createAndPurchaseSandboxLabel` e
`generateAndPrintSandboxLabel` recusam qualquer execução quando
`MELHOR_ENVIO_ENVIRONMENT` não for exatamente `sandbox`. A futura ativação em
produção deverá ser implementada separadamente, depois da regularização fiscal.

## Deploy

O projeto pode ser publicado como uma aplicação Next.js na Vercel. O arquivo
`vercel.json` mantém a detecção explícita do framework.
