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

## Deploy

O projeto pode ser publicado como uma aplicação Next.js na Vercel. O arquivo
`vercel.json` mantém a detecção explícita do framework.
