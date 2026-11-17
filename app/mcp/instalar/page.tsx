import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { resourceUrl } from "../../../lib/mcp/http";
import { CopyText } from "./CopyText";

export const metadata: Metadata = {
  title: "Conectar o Codex à Artgian",
  description: "Conecte o Codex ao catálogo da Artgian para cadastrar e editar produtos com foto.",
  robots: { index: false, follow: false },
};

export default function InstallMcpPage() {
  const endpoint = resourceUrl();
  const addCommand = `codex mcp add artgian --url ${endpoint}`;
  const skillRoot = new URL("/skills/artgian-editar-produto/", endpoint).href;
  const skillPrompt = `Instale a skill artgian-editar-produto neste computador. Baixe ${skillRoot}SKILL.md e ${skillRoot}agents/openai.yaml para a pasta pessoal ~/.agents/skills/artgian-editar-produto/, mantendo os nomes e a subpasta agents. Confira os dois arquivos antes de concluir. A instalação não exige alterar produtos.`;
  const prompt = `Conecte o Codex deste computador ao catálogo da Artgian pelo servidor MCP ${endpoint}, com o nome artgian. Reutilize a conexão existente quando disponível. Se precisar autenticar, inicie uma única sessão OAuth e mantenha-a aberta enquanto autorizo no navegador. Se o retorno local falhar, oriente-me a usar codex mcp login artgian --no-browser no meu terminal e a colar o retorno somente nesse terminal. ${skillPrompt} Depois, teste apenas a consulta aos modelos de produto, em uma nova conversa se necessário.`;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 text-[#193244] sm:py-14">
      <Link href="/" className="inline-flex items-center gap-2.5 font-semibold">
        <Image src="/artgian-monogram.png" alt="" width={40} height={40} className="rounded-xl" />
        Artgian Studio
      </Link>
      <section className="mt-6 rounded-3xl border border-[#e0ddd4] bg-white p-6 shadow-sm sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Conectar o Codex à Artgian</h1>
        <p className="mt-3 text-base leading-7">Cadastre, edite e publique produtos pelo chat. Abra esta página no computador onde você usa o Codex.</p>
        <ol className="my-6 list-decimal space-y-3 pl-5 text-sm leading-6 marker:font-bold">
          <li>Abra o Codex pelo botão abaixo e envie a mensagem que já vem preenchida.</li>
          <li>Quando o navegador abrir a Artgian, entre com seu acesso à loja, confira as permissões e selecione <strong>Autorizar conexão</strong>.</li>
          <li>Volte ao Codex e peça <strong>“Consulte os modelos de produto da Artgian”</strong> em uma conversa nova.</li>
        </ol>
        <div className="flex flex-wrap items-start gap-2">
          <a href={`codex://new?prompt=${encodeURIComponent(prompt)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193244] px-5 text-sm font-semibold text-white hover:bg-[#28495f]">
            Abrir no Codex <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <CopyText label="Copiar mensagem" value={prompt} />
        </div>
      </section>

      <section id="edicao" className="mt-4 rounded-2xl border border-[#e0ddd4] bg-white p-6 text-sm">
        <h2 className="text-lg font-semibold">Skill de edição de produtos</h2>
        <p className="my-3 leading-6">Já conectou o Codex? Instale a skill neste computador para editar um cadastro existente. Depois, peça, por exemplo, “Adicione esta foto à galeria do produto”.</p>
        <div className="flex flex-wrap items-start gap-2">
          <a href={`codex://new?prompt=${encodeURIComponent(skillPrompt)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193244] px-5 font-semibold text-white hover:bg-[#28495f]">
            Instalar skill de edição <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <CopyText label="Copiar pedido de instalação" value={skillPrompt} />
        </div>
        <a href={`${skillRoot}SKILL.md`} className="mt-3 inline-flex py-1 font-semibold underline underline-offset-4">Ler instruções da skill</a>
      </section>

      <details id="retorno" className="mt-4 rounded-2xl border border-[#e0ddd4] bg-white px-6 py-4 text-sm">
        <summary className="py-1 font-semibold">O navegador parou em 127.0.0.1 após autorizar?</summary>
        <p className="mt-4 leading-6">Esse é o endereço temporário que devolve a autorização ao Codex. Primeiro, abra uma conversa nova e peça os modelos de produto da Artgian. Se a lista aparecer, a conexão está pronta.</p>
        <p className="mt-3 leading-6">Se o Codex ainda pedir login, conclua pelo terminal do computador onde ele está configurado.</p>
        <ol className="my-3 list-decimal space-y-2 pl-5 leading-6">
          <li>Execute <code className="select-all">codex mcp login artgian --no-browser</code> e deixe o comando aberto.</li>
          <li>Abra o novo link que o comando mostrar e autorize na Artgian uma vez.</li>
          <li>Mesmo se a página local exibir erro, copie o endereço completo da barra do navegador e cole <strong>somente no terminal que está aguardando</strong>. Pressione Enter e aguarde a confirmação do Codex.</li>
        </ol>
        <CopyText label="Copiar comando de recuperação" value="codex mcp login artgian --no-browser" />
      </details>

      <details className="mt-4 rounded-2xl border border-[#e0ddd4] bg-white px-6 py-4 text-sm">
        <summary className="py-1 font-semibold">Conectar manualmente ou usar outro aplicativo</summary>
        <div className="mt-4 space-y-4 leading-6">
          <p>No Codex, abra <strong>Configurações → Servidores MCP</strong>. Adicione um servidor chamado <strong>artgian</strong> ou edite o cadastro existente. Escolha <strong>Streamable HTTP</strong> e cole o endereço abaixo.</p>
          <code className="block select-all break-all rounded-lg bg-[#f6f5f0] px-3 py-2">{endpoint}</code>
          <CopyText label="Copiar URL" value={endpoint} />
          <p>Salve, reinicie o Codex se solicitado e selecione <strong>Autenticar</strong>. Em outro aplicativo compatível com MCP remoto, use o mesmo endereço e escolha OAuth.</p>
          <p>Se aparecer <strong>Unknown</strong> antes de abrir o navegador, substitua a URL salva pelo endereço acima e tente autenticar novamente.</p>
          <details>
            <summary className="font-semibold">Usar o terminal do Codex</summary>
            <p className="mt-3">Execute no terminal do computador onde o Codex está instalado.</p>
            <code className="my-2 block select-all break-all rounded-lg bg-[#f6f5f0] px-3 py-2">{addCommand}</code>
            <CopyText label="Copiar comando" value={addCommand} />
            <p className="mt-3">Se o endereço já estiver correto e o login continuar pendente, execute <code>codex mcp login artgian</code>.</p>
          </details>
        </div>
      </details>

      <section className="px-2 pt-7">
        <h2 className="text-lg font-semibold">Seu primeiro produto</h2>
        <p className="mt-2 text-sm leading-6">Anexe a foto, informe nome, preço, medidas e peso da embalagem e peça “Cadastre e publique este produto na Artgian”. A foto é obrigatória. Se o aplicativo precisar, ele fornecerá um link para o envio.</p>
        <Link href="/admin/mcp" className="mt-4 inline-flex py-2 text-sm font-semibold underline underline-offset-4">Gerenciar conexões da loja</Link>
      </section>
    </main>
  );
}
