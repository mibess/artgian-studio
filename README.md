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

### Busca por seguidores de perfis-base

O motor abre o perfil-base, verifica o mínimo de seguidores e **clica no controle
de seguidores**. Só lê usuários da janela de seguidores validada; não usa a rota
`/followers/` diretamente nem coleta sugestões da página. A rolagem atua no
contêiner interno, mantendo a lista aberta enquanto os perfis são lidos em outra aba.

`MAX_DISCOVERY_PROFILES_PER_RUN` limita inspeções, independentemente das vagas
diárias restantes. A IA rápida qualifica lotes de até cinco perfis, reduzidos à
cota restante; rejeições permitem continuar, sem ultrapassar a meta de novos
prospectos. Usuários já conhecidos/bloqueados são excluídos, pendências ficam em
`follower_discovery_queue` por campanha/perfil-base/usuário e a conclusão do lote
só é registrada após qualificação. Perfis sem leitura aguardam sete dias antes de
nova tentativa; as demais janelas de reavaliação permanecem iguais.

Limites de navegação: `MAX_FOLLOWERS_DISCOVERY_SECONDS=900` e
`MAX_FOLLOWERS_DISCOVERY_SCROLLS=40`. O tempo é verificado antes da próxima
inspeção/rolagem, sem interromper à força a operação em andamento. O Histórico
registra motivo da parada e restrições do Instagram. Listas parciais não são
apresentadas como completas, e não há tentativa de acessar seguidores ocultos.
Falha para abrir/carregar a lista é erro, não uma busca bem-sucedida com zero perfis.

Publicação: aplicar as migrações pendentes em ordem, incluindo
`0013_hot_falcon.sql`, antes de atualizar o painel e reiniciar o worker. Esta
correção não modifica as configurações das campanhas nem dispara mensagens.

Na busca por **hashtag**, o navegador entra no resultado correspondente, abre posts
e reels e identifica seus autores por cabeçalho, metadados públicos ou concordância
entre a identificação superior, a identificação da legenda e a foto de perfil no
layout sem cabeçalho semântico.
Links de comentários, legendas e sugestões não são usados como autoria. O perfil
passa depois pela mesma qualificação da campanha; não há curtidas, comentários ou
mensagens automáticas nesta etapa.

O índice `hashtag_discovery_posts` guarda campanha, hashtag, código do post e autor.
Posts ainda não lidos e autores ainda não qualificados são retomados nas próximas
execuções. O histórico existente de perfis evita repetir usuários, inclusive quando
aparecem em diferentes posts/hashtags; as janelas de reavaliação são preservadas.
Posts sem autoria confirmada ficam como `author_unresolved` e aguardam uma hora;
isso não significa que o post esteja indisponível. Os antigos registros
`unavailable` sem autor podem ser relidos pelo leitor corrigido. Perfis
indisponíveis continuam aguardando sete dias. Limites: `MAX_HASHTAG_POSTS_PER_RUN=30`,
`MAX_HASHTAG_SCROLLS_PER_QUERY=30`, `MAX_HASHTAG_DISCOVERY_SECONDS=600`.
O tempo e o orçamento de posts são repartidos entre as hashtags selecionadas.
As inspeções alternam entre termos/hashtags com candidatos, mantendo o limite
total e a exclusão de usuários conhecidos. O Histórico mostra motivos individuais
de rejeição (filtros anteriores à IA e IA) e falhas de leitura nas últimas 20
execuções. Os detalhes valem para novas execuções; não são inferidos retroativamente.
Antes de publicar esse ajuste, aplicar a migração aditiva
`0012_slow_lila_cheney.sql` e atualizar o worker.

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

## Carrinho e contas de clientes

O cabeçalho oferece acesso a `/carrinho`, `/login` e `/conta`. Todas as páginas
com compra permitem adicionar peças, mantendo cor, quantidade e personalização.
O carrinho fica no navegador (`localStorage`), acompanha as abas da mesma origem
e permanece ao entrar ou sair da conta. O limite é de 9 unidades por variante e
30 itens diferentes. Ele não é sincronizado entre dispositivos.

`/comprar` finaliza o carrinho inteiro. Os links antigos de compra direta
(`/comprar?produto=...&cor=...&quantidade=...`) continuam funcionando e compram
apenas a seleção do link. Preços vêm do catálogo no servidor; o frete é cotado
novamente antes de criar o pagamento. A etiqueta sandbox e o painel administrativo
incluem todos os itens. O carrinho só desconta os itens comprados quando a página
de retorno recebe do banco o estado `paid`, confirmado pelo webhook; falhas e
pagamentos pendentes preservam os itens. A limpeza usa um registro da aba de
checkout, de modo que um retorno em outra aba pode manter o carrinho.

A autenticação usa Better Auth, com cadastro por e-mail e senha, sessões em
cookies HttpOnly e limite de tentativas persistido no banco. As senhas são
armazenadas em hash. `/conta` exige sessão validada no servidor e mostra apenas
pedidos associados ao ID do cliente durante o checkout. Pedidos como visitante
não são vinculados por coincidência de e-mail. É possível comprar sem login.
O acesso administrativo continua usando sua autenticação separada.

### Ativar a autenticação

1. Aplique a migração aditiva `drizzle/0014_unusual_cassandra_nova.sql` antes de
   publicar. Ela cria as tabelas `store_*` e acrescenta `orders.user_id`, sem
   alterar pedidos antigos. O banco local aplica migrações ao iniciar; no Turso,
   execute `pnpm db:migrate` com `COMMERCIAL_DATABASE_MODE=turso`,
   `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` do ambiente desejado.
2. Configure `BETTER_AUTH_SECRET` com um segredo aleatório de pelo menos
   32 caracteres (`openssl rand -base64 32`) e `BETTER_AUTH_URL` com a origem
   exata da loja, incluindo protocolo. Não reutilize o segredo dos testes.
3. Para Google, crie um cliente OAuth do tipo **Aplicativo da Web** no Google
   Cloud e configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no servidor.
   Cadastre os retornos autorizados:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Produção: `https://www.artgian.com.br/api/auth/callback/google`
   O domínio deve ser exatamente o de `BETTER_AUTH_URL`. Se o aplicativo OAuth
   estiver em teste, adicione os e-mails autorizados à tela de consentimento.
4. Reinicie o servidor após alterar as variáveis. Sem as credenciais Google,
   o botão informa a indisponibilidade e o acesso por e-mail continua disponível.

As contas Google e senha não são vinculadas automaticamente por e-mail.

### Confirmação de e-mail e recuperação de senha

O cadastro com senha exige confirmação do endereço. O login de contas ainda
não confirmadas reenvia o link; o cliente também pode solicitar outro em
`/login/verificar`. O link vale por 1 hora. Após confirmar, o cliente entra com
sua senha; abrir a mensagem não cria uma sessão automaticamente.

A recuperação está em `/login/recuperar`. O link vale por 30 minutos, só pode
ser usado uma vez e encerra todas as sessões da conta após a troca da senha.
Respostas públicas não revelam se um e-mail está cadastrado. Solicitações de
recuperação e reenvio têm limite de 3 por minuto por IP.

Antes de publicar esta versão, configure e valide o envio SMTP:

1. Na caixa Zoho que enviará as mensagens, consulte o servidor SMTP da região e
   do plano. Contas gratuitas normalmente usam `smtp.zoho.com`; contas pagas
   com domínio próprio podem usar `smtppro.zoho.com`.
2. Crie uma senha de aplicativo Zoho exclusiva para a loja. Configure
   `SMTP_HOST`, `SMTP_PORT` (465/SSL ou 587/STARTTLS), `SMTP_USER`,
   `SMTP_PASSWORD`, `AUTH_EMAIL_FROM` e `AUTH_EMAIL_REPLY_TO` no ambiente local
   e na Vercel Production. O remetente precisa ser a caixa ou um alias autorizado.
3. Valide uma mensagem real e seus registros SPF/DKIM no provedor. Só então
   publique: exigir confirmação sem um remetente funcional impediria os acessos
   por senha de contas não verificadas. O login Google continua independente.

O envio usa TLS com certificado verificado e roda com `after` do Next.js para
concluir na Vercel após a resposta HTTP. Falhas geram um erro `[auth-email]` sem
registrar endereços, senhas ou links. O usuário pode solicitar outro link quando
a entrega falhar. Não há migração de banco adicional.

Os testes de navegador usam uma caixa isolada em `data/e2e-auth-emails.jsonl`:
`AUTH_EMAIL_TEST_OUTBOX` só funciona em desenvolvimento local, sem `VERCEL`, e
nunca em produção. Não configure essa variável em deploys.

Referência SMTP: https://www.zoho.com/pt-br/mail/help/zoho-smtp.html.

Referências: [Next.js e Better Auth](https://better-auth.com/docs/integrations/next),
[configuração do Google](https://better-auth.com/docs/authentication/google).

Validação local: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` e
`pnpm exec playwright test tests/e2e/store-flow.spec.ts`. Os testes de loja usam
banco isolado e respostas simuladas de frete/pagamento, sem criar cobranças reais.

### Cupons de desconto

O painel `/admin/descontos` gerencia cupons manuais; a API `/api/coupons/game`
gera recompensas de 5%, 10%, 20% ou 30% válidas por 30 minutos, com chances
decrescentes de 40%, 30%, 20% e 10%, respectivamente. Consulte
[Cupons e integração do jogo](./docs/cupons-jogo.md) para configuração,
migração, contrato HTTP, `curl`, regras de pagamento e prompt para o jogo.
