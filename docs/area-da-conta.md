# Padrão visual da conta

Todas as rotas autenticadas em `/conta` herdam `AccountShell` pelo layout da pasta. Isso inclui pedidos, endereços, acompanhamento e conversas sobre itens comprados.

O shell concentra o menu da loja, o fundo, a largura máxima de 1024 px (centralizada dentro do `site-container`, que dá às páginas as mesmas margens laterais do menu da loja) e o cabeçalho com “Seu espaço na Artgian”, primeiro nome, email e saída da conta. Não repetir esses elementos nas páginas. A saudação é o `h1`; o título de cada seção começa em `h2` e usa `text-3xl`.

`showAccountHeader` é opcional e vale `true` por padrão. Nenhuma página atual oculta o cabeçalho. Uma futura exceção precisa declarar `showAccountHeader={false}` explicitamente no layout que renderiza o shell. Como páginas filhas não configuram layouts ancestrais, uma exceção por rota deve separar os layouts com route groups, mantendo as URLs e a largura comuns; não usar CSS para esconder o cabeçalho.

Os guards de autenticação e de propriedade dos pedidos continuam nas páginas. Isso preserva o endereço completo de retorno após o login e impede que a persistência do layout substitua a validação de acesso.
