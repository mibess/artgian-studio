# Google Analytics e visibilidade

Configuração publicada em 25/10/2026 em https://www.artgian.com.br.

- Conta Google: `artgianstudio@gmail.com`.
- Conta Analytics: `413379116`.
- Propriedade: **Artgian Studio — Site**, `560716840`; Brasil, São Paulo, BRL.
- Fluxo: **Artgian Studio — Web**, código `16200529565`.
- ID público: `G-JDHW9VHK79`.
- Variável Vercel Production: `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Alterações exigem novo build.
- **Métrica otimizada desativada** no fluxo. Não reativar sem revisar privacidade e duplicação de eventos.

## Eventos

Após o visitante selecionar **Permitir estatísticas**, o site carrega a tag e envia
`page_view`, `view_item`, `add_to_cart` e `contact_click`. Este último informa somente
o canal (WhatsApp, telefone, e-mail ou Instagram), sem copiar endereço ou mensagem.
Cliques de contato representam intenção, não atendimento ou venda confirmados.

Não há evento de compra confirmada nesta integração. Checkout, conta, login, admin,
rotas desconhecidas, textos personalizados, dados de pedido e parâmetros/fragmentos
de URL ficam fora da medição. A remoção de parâmetros também impede atribuição UTM;
se necessário, implementar uma lista controlada de campanhas, sem dados pessoais.
Sinais Google e personalização de anúncios permanecem desativados.

**Apenas essenciais** mantém a coleta desligada. O botão **Preferências de cookies**
permite mudar a escolha; revogar remove cookies GA e recarrega a página para descarregar
a biblioteca. O consentimento é salvo somente no navegador do visitante.

## Verificação

Em 25/10/2026, uma visita de validação ao site em produção apareceu no
[relatório em tempo real](https://analytics.google.com/analytics/web/#/a413379116p560716840/realtime/overview):
um usuário ativo, duas visualizações de página (home e Bandeja Aurora) e um evento
`view_item`. Isso confirma recebimento real pela propriedade correta.

Em Analytics, consultar relatórios em tempo real depois de visitar o site e permitir
estatísticas. Os relatórios consolidados podem levar até 48 horas. Bloqueadores e
recusa de consentimento reduzem os números; ausência de eventos desses visitantes é esperada.

Testes: `pnpm test`, `pnpm lint`, `pnpm typecheck`. Para testar o fluxo de consentimento:
`NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123456 pnpm exec playwright test tests/e2e/analytics.spec.ts`.
O teste de navegador intercepta a tag para não enviar eventos fictícios.

Validação da entrega: 440 testes passaram, typecheck passou e lint terminou sem
erros (15 avisos preexistentes). Os dois testes de consentimento passaram. Um teste
adicional com a biblioteca oficial do Google confirmou a codificação de
`page_view`, `view_item` e `add_to_cart`, interceptando as requisições de coleta
para não enviar esses eventos de teste.

Deploy de produção pronto: `dpl_34ZVUUDncNf1V1zY7QHmgo4eUGyX`, publicado em
https://www.artgian.com.br. Home, produto, sitemap, robots e imagem otimizada
responderam HTTP 200. O esquema do banco foi validado sem migração adicional.

## Busca orgânica

Sitemap: https://www.artgian.com.br/sitemap.xml, com páginas e imagens do catálogo.
Dados estruturados Organization/WebSite na home e Product/BreadcrumbList nos produtos.
Ofertas só usam preços de compra definidos no catálogo; não há avaliações ou endereço
inventados. Imagens principais da home usam otimização responsiva do Next.js.

O Search Console existente está em `mibexzooo@gmail.com`. O sitemap foi reenviado e
processado em 25/10/2026 (8 URLs). No relatório atualizado em 15/10/2026 havia uma
página indexada e sete detectadas ainda não indexadas; envio de sitemap não garante
indexação nem posição nos resultados.
Uma solicitação manual de indexação de `/produtos` retornou erro do próprio Google;
não há confirmação desse pedido individual. O sitemap permanece processado.

## Google Ads

Não foi configurada cobrança nem ativada campanha. A conta comercial encontrada na
sessão Artgian é `660-452-4939`, com um assistente de campanha ainda em andamento.
O texto salvo no rascunho foi corrigido de serviços de gráfica para impressão 3D,
presentes e decoração. O assistente permanece na etapa de imagens; não houve
publicação nem definição de orçamento.
A oferta pública observada exige gastar R$ 1.200 nos primeiros 60 dias para liberar
R$ 1.200 de crédito, com configuração de pagamento. Não representa saldo gratuito
disponível para anunciar sem investimento; confirmar os termos da oferta na conta
antes de qualquer ativação. Vinculação GA4/Ads e conversões Ads não foram concluídas.
