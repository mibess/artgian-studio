# Artgian Studio

Loja da Artgian Studio desenvolvida com Next.js (App Router), React e
TypeScript.

O projeto também inclui o **Artgian Comercial**, um assistente local em
`/comercial` para leads, conversas inbound, briefings, orçamentos, catálogo,
jobs e métricas. Consulte [SETUP.md](./SETUP.md) para a operação completa.

## Requisitos

- Node.js 24
- pnpm 11

## Desenvolvimento

Instale as dependências e inicie o servidor local:

```bash
pnpm install
pnpm db:setup
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Comandos

- `pnpm dev`: inicia o Next.js em modo de desenvolvimento
- `pnpm dev:all`: inicia o painel e o worker local no mesmo comando
- `pnpm build`: gera a versão de produção
- `pnpm lint`: verifica a qualidade do código
- `pnpm typecheck`: valida os tipos
- `pnpm test`: executa os testes automatizados
- `pnpm test:e2e`: valida o fluxo local no navegador
- `pnpm worker`: executa a fila persistente no ambiente local de desenvolvimento
- `pnpm worker:production`: conecta o worker operacional ao Turso `artgian-prod`
- `pnpm db:generate`: gera migrações do Drizzle

## Variáveis de ambiente

### Busca local progressiva

A busca no Maps mantém uma fila por campanha e por nicho/local. Resultados
carregados são salvos antes da inspeção; a próxima execução prioriza os pendentes.
Empresas conhecidas são ignoradas por CID/Place ID quando disponível, sem consumir
o limite de inspeções. A lista permanece aberta enquanto as fichas são consultadas.

A IA rápida valida lotes de até cinco perfis. Rejeições não encerram a busca:
ela continua até a cota de novos resultados (prospectos e empresas sem Instagram),
o limite de inspeções (`MAX_DISCOVERY_PROFILES_PER_RUN`, padrão 10), o limite de
rolagens (`MAX_LOCAL_DISCOVERY_SCROLLS`, padrão 40), o tempo disponível
(`MAX_LOCAL_DISCOVERY_SECONDS`, padrão 900) ou o fim/estagnação da lista.
O tempo é verificado antes de iniciar cada nova empresa/rolagem; uma operação já
iniciada pode terminar após esse prazo. Pausas de navegação continuam aplicadas.

O Histórico mostra o motivo de encerramento, empresas conhecidas ignoradas,
rolagens e pendências. Falhas de leitura/IA mantêm o lote não concluído na fila.
A mudança não gera mensagens ou rascunhos automaticamente.

**Publicação:** aplicar a migração aditiva `0011_eager_edwin_jarvis.sql` no banco
destino antes de publicar o painel e reiniciar o worker. Ela cria a fila e os campos
de diagnóstico, sem remover dados existentes. Testes usam bancos isolados e páginas
simuladas; não executam buscas nem envios reais.

### Configuração geral

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
