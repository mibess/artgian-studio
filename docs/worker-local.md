# Worker local e central de automação

O worker é o programa executado na estação operacional. Ele realiza as tarefas
locais, como descoberta de perfis e envios pelo Chrome dedicado. Publicar o site
na Vercel não inicia esse programa.

Há duas condições independentes para executar tarefas:

1. O programa precisa estar em execução na estação operacional.
2. A central **Automação e IA** precisa permitir a execução do worker.

A permissão começa pausada. Uma pausa no painel bloqueia novas tarefas; uma
tarefa já iniciada termina antes de o worker entrar em espera. O processo
continua comunicando seu estado ao painel enquanto estiver em espera.

O estado é comunicado a cada 30 segundos, inclusive durante tarefas longas.
Após 90 segundos sem comunicação, o painel não deve afirmar que o worker está
conectado. A ausência de comunicação pode significar programa parado, computador
desligado ou indisponibilidade do banco. Credenciais e mensagens de erro do banco
não são gravadas no sinal de estado.

## Quando for necessário retomar

Na estação operacional, atualize o código e confirme o acesso ao banco Turso e
ao Chrome dedicado. Inicie `pnpm worker:production` no diretório da aplicação e
confirme a comunicação recente no painel. Só então libere a execução na central.
As permissões de descoberta, envio e uso de IA continuam independentes.

Para uma execução manual, `Ctrl+C` encerra o worker após concluir a tarefa em
andamento. O processo comunica a parada quando o banco está acessível.

O serviço do macOS `com.artgian.commercial-worker` permanece desativado. A
publicação desta central não o reativa. Sua ativação automática exige uma ação
explícita na estação operacional e é opcional.

## Persistência e falhas

O worker consulta `local_worker_enabled` antes de buscar tarefas. Se a consulta
falhar, ele não processa novos trabalhos e tenta novamente com intervalo crescente.
O estado é salvo em `system_settings.local_worker_heartbeat`, sem criar um evento
de auditoria de operador a cada comunicação. Mudanças feitas pelo operador na
central continuam auditadas.
