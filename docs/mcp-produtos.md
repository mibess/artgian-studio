# Cadastro de produtos pela IA

## Estado da implementação

Publicado em produção em 12/11/2026 após autorização do responsável. MCP: https://www.artgian.com.br/mcp. Painel: https://www.artgian.com.br/admin/mcp. Login da CLI Turso concluído como `mibess` usando a sessão existente do navegador.

Migração `0022_omniscient_azazel` aplicada ao `artgian-prod`, com backup criptografado, ensaio de restauração e comparação integral dos dados existentes dentro do lote SQLite antes do commit. Snapshot: 43 tabelas e 10.017 registros. Backup utilizado: `backups/store-before-migrations-2026-11-13T01-40-49-313Z.json.aes`; chave em `/Users/mibess/.codex/backup-keys/artgian-studio/store-before-migrations-2026-11-13T01-40-49-313Z.key`. Os nomes dos arquivos usam UTC.

Deployment: `dpl_GhVxLnGrywbSuCX9iYeHmQbvcPc7`, https://artgian-studio-ezksyxcg9-claudemir-custodios-projects.vercel.app. Build Turbopack da Vercel e verificação do schema aprovados antes da promoção. Versão anterior para referência de rollback do aplicativo: `dpl_DiqmpSBDaCjtcdA1QAyVdYx8Pw6x` (a migração aditiva é compatível com ela).

Verificação no domínio oficial: discovery OAuth, exigência de autenticação, conexão pelo SDK oficial, seis ferramentas anunciadas, leitura dos modelos, upload da foto de referência, entrega da imagem WebP e rejeição de cadastro sem foto. O teste não criou produtos e seu acesso temporário foi revogado ao terminar. Os sete produtos públicos foram comparados antes/depois e permaneceram idênticos. A imagem de referência enviada pelo teste foi mantida em `product_images` com ID `30cefc92-3017-4a24-a275-06a34dddd7f4`.

Verificações: 475 testes aprovados com `AI_REPLY_GENERATION_ENABLED=true` no processo de teste (o teste existente de aprimoramento de rascunhos precisa da função habilitada); lint sem erros, typecheck aprovado e build com Webpack aprovado. Cinco testes de navegador passaram, incluindo o ciclo OAuth → upload por link → cadastro → publicação → carrinho → edição no admin → revogação, além dos produtos anteriores e upload manual. O build local padrão com Turbopack encontrou uma restrição de abertura de porta no processamento CSS; o build de produção equivalente foi validado com `pnpm exec next build --webpack`.

O MCP remoto usa o cadastro existente em `/admin/produtos`, a tabela `catalog_products` e os modelos de página da loja. Produtos cadastrados pela IA ficam editáveis no mesmo painel e alimentam vitrine, carrinho, checkout, frete e atendimento. Não há um catálogo paralelo.

## Conectar

Abra a [instalação da Artgian](https://www.artgian.com.br/mcp/instalar) **no computador onde usa o Codex**. Em **Produtos → Conectar IA**, “Copiar link de instalação” permite levar essa página a outro computador. O link é público e contém apenas instruções. O acesso ao catálogo exige autorização administrativa.

1. Selecione **Abrir no Codex** e envie a mensagem preenchida. Se o aplicativo não abrir, use **Copiar mensagem** e cole em uma conversa local do Codex.
2. Entre na loja quando o navegador abrir a autorização, revise as permissões e selecione **Autorizar conexão**. O próprio aplicativo inicia o OAuth no computador que receberá o acesso.
3. Volte ao Codex e confira a resposta à consulta de modelos. Para cadastrar o primeiro produto, anexe a foto e informe seus dados.

Para instalar manualmente no Codex, abra **Configurações → Servidores MCP**, adicione ou edite `artgian`, escolha **Streamable HTTP**, cole `https://www.artgian.com.br/mcp` e salve. Reinicie se solicitado e selecione **Autenticar**. No terminal, use `codex mcp add artgian --url https://www.artgian.com.br/mcp`. Se já estiver configurado com a URL correta, use `codex mcp login artgian` para iniciar a autorização pendente. Outros aplicativos compatíveis podem usar o mesmo endpoint e OAuth.

O painel em `/admin/mcp` mostra cada autorização, as permissões e a opção de revogar. “Aguardando o aplicativo” indica que a loja recebeu o consentimento e aguarda a troca do código. “Autorizada” indica que o aplicativo obteve credenciais válidas. O painel também sinaliza credenciais expiradas e conexões revogadas. [Links oficiais do Codex](https://learn.chatgpt.com/docs/reference/commands#deep-links) e [configuração oficial de MCP](https://learn.chatgpt.com/docs/extend/mcp).

### Retorno ao Codex depois de autorizar

Quando o navegador já chegou a `127.0.0.1` com um código, a descoberta e o consentimento ocorreram. O endereço pertence à tentativa de login iniciada pelo Codex. Abra uma conversa nova e peça “Consulte os modelos de produto da Artgian”. Se o login continuar pendente, execute `codex mcp login artgian --no-browser` no terminal do ambiente onde o servidor está configurado e mantenha o processo aberto. Autorize pelo novo link e cole o endereço de retorno completo da barra do navegador diretamente nesse terminal, mesmo que a página local mostre erro. O endereço contém um código de uso único. [Retorno manual no Codex](https://learn.chatgpt.com/docs/extend/mcp#other-cli-commands).

### Falha de descoberta OAuth no Codex

Use exatamente `https://www.artgian.com.br/mcp`, incluindo `www`. Em 13/11/2026, o Codex CLI `0.167.0-alpha.4.1` conseguiu descobrir os metadados e gerar a URL de autorização com `products:read` nesse endereço. A URL sem `www` reproduziu a falha antes de abrir o navegador: `OAuth discovery redirect to non-same-origin URL rejected: https://www.artgian.com.br/mcp`. O domínio sem `www` redireciona para outra origem e o cliente recusa esse redirecionamento durante a descoberta. Corrigir a URL na configuração do cliente, preservando o nome do servidor, e iniciar o login novamente. O diagnóstico foi reproduzido localmente; a autorização de um cliente em outro computador precisa ser concluída naquele computador.

O comando de login também precisa de acesso à rede. Em um terminal restrito pelo sandbox, a resolução do domínio pode falhar; execute o login no terminal normal da máquina ou com a permissão de rede adequada. Não interprete o estado `enabled` como prova de OAuth concluído.

O servidor implementa discovery OAuth, registro dinâmico de clientes públicos ou confidenciais (`client_secret_post`), authorization code com PKCE S256, tokens de acesso de uma hora, refresh com rotação de 30 dias, vínculo ao recurso e revogação da conexão. Clientes precisam enviar `resource` com a URL exata do MCP em autorização e troca de token. Registro por Client ID Metadata Documents e o transporte SSE antigo não são oferecidos nesta versão.

Permissões: `products:read`, `images:write`, `products:write`, `products:publish`. A publicação só pode alcançar produtos criados pela própria conexão. O protocolo não consegue verificar a intenção humana no texto do chat: a ferramenta exige `publish` explícito e orienta o cliente a usá-lo somente após o pedido do usuário. O aplicativo de IA pode exigir sua própria confirmação.

Exemplo de comando, com foto anexada:

> Cadastre e publique este produto na Artgian: Kit Natalino Tricô, 6 peças, R$ 55,00. Acompanha árvore, Papai Noel, pinguim, rena, urso e bandeja 18 × 18 × 2 cm. Embalagem 20 × 20 × 8 cm, peso de envio 270 g. Use a foto anexada e siga a estrutura da loja.

O modelo do cliente interpreta os dados e escreve os textos. O MCP valida os campos e realiza as operações. Informações ausentes não devem ser inventadas; divergências entre descrição e foto devem ser esclarecidas. A integração não faz OCR nem geração de capa automaticamente. Uma capa criada pela IA pode ser enviada como outra imagem, junto da referência original.

Para reproduzir a estrutura de um produto do site, a IA consulta `get_product_templates({summaryOnly: true})`, compara os exemplos em `pageUrl` e busca o exemplo escolhido com `referencePath` igual ao caminho `url`. Em `create_product.presentation` ou em `update_product.changes.presentation`, envia o `template` da referência, os textos nas mesmas chaves de `copy`, cores e características próprios da peça. O cadastro sem apresentação usa `standard`. Alterar apenas a capa ou a galeria preserva o modelo atual.

## Ferramentas

### Editar um produto existente

A instalação guiada também oferece a skill `artgian-editar-produto`. Quem já estiver conectado pode abrir [Instalar skill de edição](https://www.artgian.com.br/mcp/instalar#edicao) no computador do Codex e enviar só o pedido de instalação da skill. O Codex baixa o [SKILL.md oficial](https://www.artgian.com.br/skills/artgian-editar-produto/SKILL.md) e os metadados da loja para `~/.agents/skills/artgian-editar-produto/`. A skill pode ser usada pelo nome ou com um pedido como “Adicione esta foto à galeria da Decoração Beatles”.

A busca requer `products:write` e inclui rascunhos e produtos criados pela própria conexão. O acesso `products:read` permite consultar os modelos públicos. A edição preserva os campos omitidos e o estado de publicação. Use a versão retornada pela última leitura e, em caso de conflito, consulte o produto novamente. Para editar um item que já está ativo são necessárias as permissões `products:write` e `products:publish`. Novas imagens devem ser enviadas com `images:write`. A publicação de um rascunho continua disponível pelo comando explícito.

| Ferramenta | Finalidade |
| --- | --- |
| `get_product_templates` | Comparar modelos públicos da vitrine e obter a apresentação completa de uma referência pelo caminho da página. |
| `upload_product_image` | Enviar o arquivo em base64 e receber `imageId`. |
| `create_upload_link` | Link válido por 15 minutos para upload pelo usuário. |
| `list_uploaded_images` | Buscar IDs das últimas 30 imagens da conexão. |
| `create_product` | Criar com imagem obrigatória; `publish: true` publica, `false` cria rascunho inativo. |
| `find_editable_products` | Localizar por nome, slug ou ID e consultar os dados e a versão de um produto acessível à conexão. |
| `update_product` | Alterar os campos indicados ou anexar imagens ao produto existente usando a versão atual. |
| `publish_product` | Publicar um rascunho criado pela conexão, preservando a versão do registro. |

`create_product` recebe nome, slug, categoria, descrição, preço em centavos, `imageIds`, `shippingPackage`, `publish` e `idempotencyKey`. Também aceita materiais, aliases, prazo, fatos verificados, variantes, personalização e apresentação dos modelos existentes. Para compra direta publicada, embalagem e peso são obrigatórios. Valores desconhecidos não são deduzidos da foto. Rascunhos aceitam embalagem nula e não ficam acessíveis na página pública. A primeira imagem enviada é a capa; as demais formam a galeria.

O campo opcional `fulfillment`, disponível em `create_product` e `update_product.changes`, estrutura a disponibilidade e o prazo até postagem: `{ "readyToShip": true, "preparationDays": 2 }` indica peça pronta com envio em até 2 dias úteis após a confirmação do pagamento. `readyToShip: false` significa produção sob encomenda e exige pelo menos 1 dia útil. `preparationDays` aceita inteiros entre 0 e 365; zero representa uma peça pronta sem prazo adicional de preparação e deve ser confirmado pelo lojista. O prazo da transportadora é calculado separadamente pelo CEP. Não preencha esses valores por suposição, nem copie o prazo de um produto usado apenas como referência visual. `find_editable_products` retorna o valor em `product.fulfillment`, e o atendimento lê a mesma fonte. Nas edições, omitir `fulfillment` preserva a informação existente; enviar `null` a remove. Cadastros anteriores sem o campo permanecem compatíveis e conservam a observação legada `productionTime`.

No admin, abra **Produtos → Dados e venda → Disponibilidade e prazo para envio**. Escolha a disponibilidade e preencha os dias úteis; a prévia usa o mesmo texto da loja. O prazo estruturado tem prioridade sobre a observação antiga de produção tanto na loja quanto no atendimento. Sem ele, a observação anterior permanece como referência até a confirmação.

Cada pedido de cadastro usa uma chave de idempotência estável. Repetir os mesmos dados retorna o registro original; reutilizar a chave com outros dados dá conflito. Cadastro e registro da chave são transacionais. Edições posteriores podem ser feitas no admin ou com `update_product`. `publish_product` não edita o conteúdo e recusa versão desatualizada.

## Upload obrigatório

Não basta informar uma URL. A imagem precisa existir no armazenamento da loja antes do cadastro, inclusive no admin. O MCP só aceita imagens pertencentes à conexão. O admin mantém suporte às imagens reais existentes em `public/` e às imagens do novo upload; URLs externas precisam ser substituídas por upload.

São aceitos PNG, JPEG e WebP estáticos, até 2 MiB, pelo menos 100 × 100 pixels e no máximo 24 milhões de pixels. O servidor decodifica o arquivo, remove metadados, limita a resolução a 1600 × 1600 e salva WebP com até 1,5 MB. Imagens ficam na tabela `product_images`, disponíveis em `/api/product-images/<id>` sem novo deploy. A deduplicação usa conexão e hash do conteúdo. Essa opção reutiliza o banco e não exige contratação de outro armazenamento; em catálogos grandes, considerar armazenamento de objetos para reduzir o volume de dados no banco.

O endpoint de upload do admin é `POST /api/admin/products/images`. O do MCP é `POST /api/mcp/images`, com Bearer de acesso ou `x-upload-token` de um link. O corpo é o arquivo binário, não multipart. O cliente de IA também pode usar `upload_product_image` diretamente. O link usa fragmento (`#token`), não query string; o token não vai nos logs de URL e só autoriza envio de imagem, nunca cadastro ou publicação. Não compartilhar o link. Imagens enviadas têm URLs públicas e não devem conter informações privadas.

Compatibilidade de anexos depende do aplicativo: o MCP não acessa automaticamente um arquivo apenas porque ele aparece no chat. Se o cliente não conseguir ler/encaminhar o anexo, deve criar o link e aguardar o envio. Não deve fabricar base64 nem marcar o produto como cadastrado antes do resultado da ferramenta.

Limites persistidos no banco: 300 pedidos MCP/hora/conexão, 30 uploads/hora/conexão, 30 links/hora/conexão; registro e token têm limites globais. O servidor não baixa URLs externas, evitando requisições para endereços internos. Tokens são armazenados somente como hashes e as alterações de produto mantêm o histórico de auditoria com o identificador da conexão.

## Implantação

1. Instalar dependências com `pnpm install --frozen-lockfile`.
2. Configurar `MCP_PUBLIC_URL` para a URL pública exata terminada em `/mcp`. Para teste local, usar `http://127.0.0.1:3108/mcp`. `ADMIN_USERNAME` e `ADMIN_PASSWORD` são os mesmos do admin. Não criar senha compartilhada para a IA.
3. Aplicar a migração aditiva `0022_omniscient_azazel` no banco do ambiente. O script exige baseline `0021_mibess_notify_outbox`, faz backup criptografado e ensaio de restauração, e só escreve com `--apply`: `node scripts/migrate-store-with-backup.mjs --mcp --env=/caminho/seguro.env --apply`. Alternativamente, `--runtime-env` aceita credenciais temporárias passadas em memória, sem arquivo de segredos. Para MCP, validação e aplicação usam um único lote atômico com cópias temporárias e comparação SQL dos dados antes/depois, evitando transações interativas longas. A migração de produção já foi aplicada; o script reconhece o estado atual e não a repete.
4. Publicar o aplicativo na Vercel. O verificador de schema bloqueia publicação se as tabelas ou os índices estiverem ausentes.
5. Abrir `/admin/produtos` → “Conectar IA”, conectar um cliente e testar com uma imagem real.

`MCP_ALLOWED_ORIGINS` permite origens web adicionais separadas por vírgula. Sem configuração, chamadas de navegador ao MCP só aceitam a origem da loja. Clientes nativos e servidores normalmente não enviam `Origin`. Não adicionar `*`.

`scripts/smoke-mcp.mjs --run` faz a verificação de produção com credenciais do banco passadas pelo ambiente. O acesso MCP do teste dura no máximo cinco minutos, permite apenas leitura e upload, e é revogado em `finally`. Não concede permissão de criar ou publicar produtos. Mantém a referência de imagem enviada e a conexão revogada no histórico.

Referências: [SDK oficial MCP](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x), [autorização MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
