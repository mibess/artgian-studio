# Kit Natalino Tricô

Cadastro pronto em `kit-natalino-trico.json`, usando o modelo existente Bandeja Aurora, sem criar uma estrutura paralela de catálogo. Inclui compra direta, variante única, galeria, textos editáveis, benefícios, conteúdo, medidas, pacote de frete, SEO e informações de atendimento.

## Publicado em produção

Publicado em 17/09/2026 em https://www.artgian.com.br/produtos/kit-natalino-trico, por autorização do responsável. Registro `9053c32d-3cba-4b21-a573-c4a206f0fbec`, versão 1, criado pela API administrativa de produção. Preço: R$ 55,00.

A loja em produção já possuía o cadastro unificado; nenhuma migração foi necessária. Os arquivos locais de conexão estavam desatualizados e não foram usados para modificar o banco. Os seis produtos anteriores foram comparados antes da promoção e preservados. Cópia do catálogo público anterior: `backups/catalog-before-kit-natalino-2026-09-17.json` (ignorada pelo Git).

Deployment: `dpl_2xfov5sDw2UU3gHHLUK6ZtzpLnrU`, https://artgian-studio-e9vo99w0c-claudemir-custodios-projects.vercel.app, promovido ao domínio oficial após compilar com sucesso. `.vercelignore` agora exclui arquivos `.env*`, exceto `.env.example`, para não enviar credenciais.

Verificação: 235 testes unitários aprovados, lint sem erros, typecheck e build de produção aprovados. No domínio oficial, verificados preço, pacote de frete, imagens carregadas, vitrine, carrinho, ausência de overflow no celular, sitemap e preservação dos seis cadastros anteriores. Capturas em `test-results/kit-natalino-producao-desktop.png` e `test-results/kit-natalino-producao-mobile.png`.

Comando usado para criar o registro pela mesma API do admin (não repetir: o produto já existe):

```sh
pnpm exec tsx scripts/register-product.ts --apply --url=https://www.artgian.com.br --env=.env.prod
```

Sem `--apply`, o comando apenas valida. O importador aceita apenas novos registros e não sobrescreve produtos existentes. Para futuras edições, usar `/admin/produtos`, preservando ID, endereço e versão.

Confirmar: a lista fornecida chama de pinguim a figura que se assemelha a um boneco de neve na referência. Os textos preservam a lista; as imagens preservam a referência. Os 270 g informados foram usados no frete; confirmar se incluem a embalagem. Material e prazo não foram inventados.

## Imagem personalizada

Modo: ferramenta integrada de geração de imagens, sem CLI/API externa. Arte salva em `/Users/mibess/www/artgian-studio/public/kit-natalino-trico-capa.png`; referência preservada em `/Users/mibess/www/artgian-studio/public/kit-natalino-trico-referencia.png`.

Prompt usado:

> Use case: product-mockup. Asset type: imagem de capa personalizada para catálogo Artgian Studio, vertical 4:5. Image 1 is the exact product reference: preserve ALL five existing Christmas figurines and their physical designs, colors, molded knit-like textures, eyes, accessories and the white circular fluted tray unchanged. Do not add or remove pieces, do not reinterpret the snowman-looking figure as a penguin. Image 2 is only an art direction reference: elegant warm cream studio setting with restrained geometric framing. Create a polished catalog product photograph of the exact kit in Image 1, arranged together as in the original, the entire tray visible and centered in lower two thirds, adequate breathing room. Change only backdrop, lighting and framing: softly lit warm ivory background, a subtle deep evergreen curved architectural shape at upper right, delicate gold thin-line accent along left edge, premium editorial product photography, diffuse warm light, natural contact shadows. Product must remain the focal point. No text, no price, no logos, no watermark, no extra decorations or products. The texture is a rigid decorative product with knit-pattern surface, not actual newly crocheted yarn.
