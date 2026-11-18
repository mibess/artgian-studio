import Link from "next/link";
import { ArrowUpRight, MessageCircle, Plus } from "lucide-react";
import { WHATSAPP_URL } from "../../lib/custom-order";

const answerLink = "font-semibold text-[#0b2447] underline underline-offset-4 hover:text-[#76511e]";

const questions = [
  {
    question: "Como faço uma compra pelo site?",
    answer: (
      <>
        Escolha uma peça no <Link className={answerLink} href="/produtos">catálogo</Link>, selecione as opções
        disponíveis e adicione ao carrinho ou clique em Comprar agora. Para finalizar, entre na sua
        conta ou crie uma. Depois, informe o endereço e escolha o frete e a forma de pagamento.
      </>
    ),
  },
  {
    question: "Como consulto o frete e o prazo de entrega?",
    answer: (
      <>
        Informe seu CEP na página da peça para consultar o frete sem entrar na conta. A estimativa
        de entrega soma a preparação ao tempo de transporte. Se o prazo de preparação estiver a
        confirmar, consulte a Artgian antes de comprar.
      </>
    ),
  },
  {
    question: "Qual a diferença entre pronta entrega e sob encomenda?",
    answer: (
      <>
        Uma peça de pronta entrega já está produzida e pode precisar de tempo para embalagem e
        postagem. Uma peça sob encomenda é produzida após a confirmação do pagamento. Confira o
        prazo para envio na página de cada peça.
      </>
    ),
  },
  {
    question: "Posso personalizar uma peça ou pedir um projeto sob medida?",
    answer: (
      <>
        Quando a peça oferecer personalização, preencha o campo na própria página do produto.
        Para um projeto sob medida, <Link className={answerLink} href="/personalizados#orcamento">monte seu pedido</Link> e
        envie a ideia pelo WhatsApp para combinar o orçamento e o prazo com a Artgian.
      </>
    ),
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer: <>Você pode pagar com Pix, cartão ou boleto ao finalizar a compra no site.</>,
  },
  {
    question: "Onde aplico meu cupom de desconto?",
    answer: (
      <>
        Na etapa de finalizar a compra, preencha o campo Código do cupom e clique em Aplicar cupom.
        Confira o desconto no resumo do pedido antes de pagar.
      </>
    ),
  },
  {
    question: "Onde acompanho meu pedido e encontro o código de rastreio?",
    answer: (
      <>
        Entre em <Link className={answerLink} href="/conta">Minha conta</Link> e vá até Seus pedidos.
        Após a aprovação do pagamento, clique em Acompanhar pedido para ver as etapas da entrega e
        o código de rastreio assim que estiver disponível. Para tirar dúvidas sobre uma peça comprada,
        use a opção Falar com o vendedor no item.
      </>
    ),
  },
];

export default function StoreFaq() {
  return (
    <section
      id="perguntas-frequentes"
      aria-labelledby="store-faq-title"
      className="scroll-mt-28 border-b border-[#0b2447]/10 px-5 py-16 sm:px-10 lg:px-[8vw] lg:py-24"
    >
      <div className="mx-auto grid max-w-[1600px] gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-8">
        <h2
          id="store-faq-title"
          className="font-serif text-[clamp(2.5rem,5vw,4.8rem)] leading-none tracking-[-0.055em]"
        >
          Perguntas <em className="font-normal text-[#8a6427]">frequentes</em>
        </h2>

        <div className="divide-y divide-[#0b2447]/12 border-y border-[#0b2447]/12 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {questions.map(({ question, answer }) => (
            <details className="group" key={question}>
              <summary className="flex min-h-14 list-none items-center justify-between gap-4 rounded-sm py-3.5 font-serif text-lg leading-snug focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a6427] marker:hidden sm:text-xl [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-[#0b2447]/15 text-[#8a6427] group-open:bg-[#ebe4d8]">
                  <Plus className="size-4 motion-safe:transition-transform group-open:rotate-45" />
                </span>
              </summary>
              <p className="max-w-prose pb-5 text-sm leading-relaxed text-[#526273]">{answer}</p>
            </details>
          ))}
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit max-w-full items-center gap-3 self-start rounded-2xl border border-[#b88a3b]/30 bg-[#ebe4d8] px-4 py-3 text-sm transition-colors hover:bg-[#e5dac7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a6427] lg:col-start-1 lg:row-start-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fffdf8] text-[#087d45]">
            <MessageCircle aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block text-xs">Ficou com dúvida?</span>
            <span className="font-semibold">Chame no WhatsApp<span className="sr-only"> (abre em nova aba)</span></span>
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-[#8a6427]" />
        </a>
      </div>
    </section>
  );
}
