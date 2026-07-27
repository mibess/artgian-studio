const sectionLabel =
  "flex items-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.2em]";
const sectionNumber =
  "grid size-10 place-items-center rounded-full border border-current font-serif text-sm font-normal tracking-normal";
const serifTitle =
  "font-serif font-normal leading-[0.92] tracking-[-0.055em]";

const steps = [
  ["01", "Você imagina", "Sua ideia, seu propósito."],
  ["02", "Projetamos juntos", "Do conceito ao detalhe."],
  ["03", "Produzimos com precisão", "Impressão 3D de alta fidelidade."],
  ["04", "Entregamos memórias", "Peças únicas, feitas para durar."],
];

const projects = [
  {
    number: "01",
    category: "Casa",
    title: "Bandeja Aurora. Organização em forma de escultura.",
    alt: "Bandeja Aurora impressa em 3D",
    position: "object-center",
    image: "/bandeja-aurora-capa.png",
    href: "/bandeja-aurora",
  },
  {
    number: "02",
    category: "Organização",
    title: "Organizador Arco. Ordem com personalidade.",
    alt: "Organizador Arco rosa com gavetas",
    position: "object-center",
    image: "/organizador-arco-capa.png",
    href: "/organizador-arco",
  },
  {
    number: "03",
    category: "Colecionáveis",
    title: "Detalhes que dão vida à imaginação.",
    alt: "Miniatura detalhada impressa em 3D",
    position: "object-[93%_72%]",
    image: "/hero-gallery.png",
    href: "#orcamento",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ea] text-[#0b2447]">
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 px-4 py-3 shadow-[0_18px_60px_rgba(11,36,71,0.13),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[#0b2447]/5 backdrop-blur-2xl sm:px-6">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent" />
          <div className="pointer-events-none absolute -top-16 left-1/4 size-36 rounded-full bg-white/70 blur-3xl" />

          <a
            className="relative z-10 flex shrink-0 items-center gap-3"
            href="#inicio"
            aria-label="Artgian Studio — início"
          >
            <span className="grid size-10 place-items-center overflow-hidden rounded-full border border-white/80 bg-[#f7f3ea]/80 shadow-sm sm:size-11">
              <img
                className="size-16 max-w-none mix-blend-multiply"
                src="/artgian-logo.jpeg"
                alt=""
              />
            </span>
            <span className="flex flex-col leading-none">
              <b className="font-serif text-xl font-normal tracking-[0.08em] sm:text-2xl">
                Artgian
              </b>
              <small className="mt-1 pl-0.5 text-[0.5rem] font-bold uppercase tracking-[0.48em]">
                studio
              </small>
            </span>
          </a>

          <nav
            className="relative z-10 hidden items-center gap-1 rounded-full border border-white/50 bg-white/30 p-1 lg:flex"
            aria-label="Navegação principal"
          >
            {[
              ["Produtos", "#produtos"],
              ["Personalizados", "#personalizados"],
              ["Como funciona", "#como-funciona"],
              ["Sobre", "#sobre"],
            ].map(([label, href]) => (
              <a
                key={href}
                className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-white/70 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b]"
                href={href}
              >
                {label}
              </a>
            ))}
          </nav>

          <a
            className="relative z-10 inline-flex items-center gap-2 rounded-full bg-[#0b2447] py-2.5 pr-3 pl-4 text-xs font-semibold text-[#fffdf8] shadow-lg shadow-[#0b2447]/15 transition hover:-translate-y-0.5 hover:bg-[#143866] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88a3b] sm:gap-3 sm:py-3 sm:pr-4 sm:pl-5 sm:text-sm"
            href="#orcamento"
          >
            <span className="hidden sm:inline">Pedir orçamento</span>
            <span className="sm:hidden">Orçamento</span>
            <span
              className="grid size-7 place-items-center rounded-full bg-[#d8bc7b] text-base text-[#0b2447]"
              aria-hidden="true"
            >
              ↗
            </span>
          </a>
        </div>
      </header>

      <section
        className="relative mx-auto min-h-screen max-w-[1600px] px-5 pt-36 pb-12 sm:px-8 sm:pt-44 lg:px-16"
        id="inicio"
      >
        <div className="relative z-10 inline-flex items-center gap-3 rounded-full border border-[#b88a3b]/70 bg-[#fffdf8]/60 px-4 py-2 text-xs font-semibold text-[#9b702a] backdrop-blur-sm sm:ml-[3%] sm:text-sm">
          Impressão 3D <i className="size-1 rounded-full bg-[#b88a3b]" /> Feito
          sob medida
        </div>

        <h1
          className={`${serifTitle} relative z-10 mt-7 max-w-6xl text-[clamp(3.9rem,8.5vw,8.4rem)]`}
        >
          Ideias ganham{" "}
          <span className="text-transparent [-webkit-text-stroke:1.2px_#0b2447]">
            forma.
          </span>{" "}
          Detalhes
          <strong className="block font-normal sm:ml-[18%]">
            viram memória.
          </strong>
        </h1>

        <div className="relative mt-10 lg:-mt-12 lg:ml-[8%]">
          <div className="h-[30rem] overflow-hidden rounded-[2rem] bg-[#e9dfcf] shadow-[0_30px_80px_rgba(11,36,71,0.12)] sm:h-[38rem] lg:h-[42rem]">
            <img
              className="h-full w-full object-cover object-center mix-blend-multiply transition duration-700 hover:scale-[1.015]"
              src="/hero-gallery.png"
              alt="Chaveiro de ursinho, escultura, luminária e miniatura impressos em 3D"
            />
          </div>

          <a
            className="absolute -bottom-6 left-5 grid size-32 place-content-center rounded-full border border-white/50 bg-[linear-gradient(145deg,rgba(216,188,123,.96),rgba(184,135,50,.92))] text-center font-serif text-lg leading-tight shadow-[0_18px_50px_rgba(87,59,18,.25)] backdrop-blur-xl transition hover:-rotate-3 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b2447] sm:left-[38%] sm:size-40 sm:text-xl"
            href="#orcamento"
          >
            <span className="text-2xl" aria-hidden="true">
              ◇
            </span>
            Pedir
            <br />
            orçamento
          </a>
          <div className="absolute top-1/2 right-5 hidden flex-col items-center gap-2 rounded-full border border-white/60 bg-white/45 px-3 py-5 font-serif text-lg backdrop-blur-xl sm:flex">
            <b className="font-normal">01</b>
            <i className="h-8 w-px rotate-[35deg] bg-[#b88a3b]" />
            <span>03</span>
          </div>
        </div>

        <div
          className="mt-20 grid gap-7 border-t border-[#b88a3b]/40 pt-8 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Etapas do processo"
        >
          {steps.map(([number, title, description]) => (
            <article className="flex gap-4" key={number}>
              <b className="font-serif text-lg font-normal text-[#b88a3b]">
                {number}
              </b>
              <div>
                <strong className="text-xs">{title}</strong>
                <span className="mt-1 block text-[0.68rem] text-[#657086]">
                  {description}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="bg-[#0b2447] px-5 py-24 text-[#f7f3ea] sm:px-10 lg:px-[8vw] lg:py-32"
        id="sobre"
      >
        <div className={`${sectionLabel} text-[#d8bc7b]`}>
          <span className={sectionNumber}>02</span> Nossa essência
        </div>
        <p className="mt-16 ml-auto max-w-sm text-sm leading-7 text-[#b8c1cf]">
          Entre o que você imagina e o que pode tocar, existe um processo.
        </p>
        <h2
          className={`${serifTitle} mt-4 max-w-6xl text-[clamp(3.5rem,8vw,8rem)]`}
        >
          Transformamos o extraordinário em{" "}
          <em className="font-normal text-[#d8bc7b]">forma.</em>
        </h2>
        <div className="mt-16 flex flex-col justify-between gap-8 border-t border-[#d8bc7b]/30 pt-8 sm:flex-row">
          <p className="max-w-md text-base leading-7">
            Unimos desenho, tecnologia e acabamento cuidadoso para criar objetos
            que carregam significado.
          </p>
          <span className="font-serif text-lg leading-7 text-[#d8bc7b] sm:text-right">
            Precisão no processo.
            <br />
            Personalidade no resultado.
          </span>
        </div>
      </section>

      <section
        className="mx-auto max-w-[1600px] px-5 py-24 sm:px-8 lg:px-16 lg:py-32"
        id="produtos"
      >
        <header className="grid items-end gap-8 lg:grid-cols-[.8fr_1.25fr_.7fr]">
          <div className={sectionLabel}>
            <span className={sectionNumber}>03</span> Criações em destaque
          </div>
          <h2 className={`${serifTitle} text-[clamp(3.2rem,6vw,6rem)]`}>
            Uma galeria de
            <br />
            <i className="font-normal text-[#b88a3b]">possibilidades.</i>
          </h2>
          <p className="max-w-sm text-sm leading-7 text-[#647087]">
            Peças decorativas, presentes, miniaturas e soluções funcionais
            feitas camada por camada.
          </p>
        </header>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {projects.map((project) => (
            <a className="group block" href={project.href} key={project.number}>
              <div className="aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#e9dfcf]">
                <img
                  className={`h-full w-full object-cover ${project.position} transition duration-700 ease-out group-hover:scale-105`}
                  src={project.image}
                  alt={project.alt}
                />
              </div>
              <span className="mt-5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#b88a3b]">
                {project.number} / {project.category}
              </span>
              <h3 className="mt-2 max-w-sm font-serif text-2xl font-normal">
                {project.title}
              </h3>
              <span className="mt-4 inline-flex items-center gap-3 border-b border-[#b88a3b]/60 pb-1 text-xs font-semibold opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {project.number === "03" ? "Criar algo assim" : "Conhecer a peça"}{" "}
                <b className="text-[#b88a3b]">→</b>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section
        className="grid bg-[#ebe4d8] lg:grid-cols-2"
        id="personalizados"
      >
        <div className="relative min-h-[34rem] overflow-hidden lg:min-h-[48rem]">
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src="/personalized-gifts.png"
            alt="Presentes personalizados produzidos pela Artgian Studio"
          />
          <span className="absolute right-5 bottom-5 rounded-2xl border border-white/50 bg-white/45 px-5 py-4 font-serif text-lg shadow-lg backdrop-blur-xl sm:right-8 sm:bottom-8">
            Feito especialmente
            <br />
            para alguém.
          </span>
        </div>
        <div className="flex flex-col justify-center px-5 py-20 sm:px-12 lg:px-[7vw]">
          <div className={sectionLabel}>
            <span className={sectionNumber}>04</span> Personalizados
          </div>
          <h2 className={`${serifTitle} mt-10 text-[clamp(3.1rem,5vw,5.8rem)]`}>
            Não é apenas um objeto.{" "}
            <i className="font-normal text-[#b88a3b]">É a sua ideia.</i>
          </h2>
          <p className="mt-8 max-w-xl text-sm leading-7 text-[#647087]">
            Do nome na peça à criação de um formato exclusivo, cada projeto
            começa com uma conversa e termina com algo que só poderia ser seu.
          </p>
          <ul className="mt-10 divide-y divide-[#0b2447]/15 border-y border-[#0b2447]/15">
            {[
              "Lembranças para eventos e celebrações",
              "Presentes com nomes, frases e símbolos",
              "Protótipos e pequenas séries",
              "Decoração e organização sob medida",
            ].map((item, index) => (
              <li className="flex gap-5 py-4 text-sm" key={item}>
                <span className="font-serif text-[#b88a3b]">
                  0{index + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
          <a
            className="mt-9 inline-flex w-fit items-center gap-5 border-b border-[#b88a3b] pb-2 text-sm font-semibold"
            href="#orcamento"
          >
            Criar uma peça personalizada{" "}
            <b className="text-xl text-[#b88a3b]">→</b>
          </a>
        </div>
      </section>

      <section
        className="grid bg-[#0b2447] text-[#f7f3ea] lg:grid-cols-[1.05fr_.95fr]"
        id="como-funciona"
      >
        <div className="px-5 py-24 sm:px-12 lg:px-[8vw] lg:py-32">
          <div className={`${sectionLabel} text-[#d8bc7b]`}>
            <span className={sectionNumber}>05</span> Como funciona
          </div>
          <h2 className={`${serifTitle} mt-10 text-[clamp(3.2rem,5.6vw,6rem)]`}>
            Da primeira conversa à{" "}
            <i className="font-normal text-[#d8bc7b]">última camada.</i>
          </h2>
          <div className="mt-14 divide-y divide-[#d8bc7b]/25 border-y border-[#d8bc7b]/25">
            {[
              [
                "Conte a sua ideia",
                "Envie uma referência, um desenho ou simplesmente explique o que você imaginou.",
              ],
              [
                "Ajustamos o projeto",
                "Definimos dimensões, cores, material e acabamento antes da produção.",
              ],
              [
                "Produzimos e entregamos",
                "Sua peça é impressa, revisada e preparada com todo o cuidado.",
              ],
            ].map(([title, description], index) => (
              <article className="grid grid-cols-[3rem_1fr] gap-3 py-7" key={title}>
                <span className="font-serif text-[#d8bc7b]">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-serif text-xl">{title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[#b8c1cf]">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="relative min-h-[36rem] overflow-hidden lg:min-h-full">
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src="/process-printing.png"
            alt="Impressora 3D criando uma peça em camadas"
          />
          <span className="absolute right-6 bottom-6 rounded-2xl border border-white/40 bg-[#0b2447]/45 px-5 py-4 font-serif text-lg text-white shadow-xl backdrop-blur-xl">
            Precisão
            <br />
            camada a camada
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
        <div className={sectionLabel}>
          <span className={sectionNumber}>06</span> Por que Artgian
        </div>
        <div className="mt-12 grid gap-10 border-t border-[#0b2447]/15 pt-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <h2 className={`${serifTitle} text-[clamp(3rem,4.5vw,5rem)]`}>
            Design com propósito.
            <br />
            <i className="font-normal text-[#b88a3b]">Produção com cuidado.</i>
          </h2>
          {[
            ["◇", "Criação próxima", "Você participa das escolhas para que o resultado tenha a sua identidade."],
            ["✦", "Detalhe visível", "Cada camada faz parte da estética e recebe atenção do início ao acabamento."],
            ["○", "Feito para durar", "Materiais selecionados e produção consciente, sem excessos ou desperdícios."],
          ].map(([icon, title, description]) => (
            <article key={title}>
              <b className="font-serif text-3xl font-normal text-[#b88a3b]">
                {icon}
              </b>
              <h3 className="mt-5 font-serif text-xl">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#647087]">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="mx-3 mb-3 grid overflow-hidden rounded-[2rem] bg-[#d8bc7b] lg:grid-cols-[1.25fr_.75fr]"
        id="orcamento"
      >
        <div className="px-6 py-20 sm:px-12 lg:px-[7vw] lg:py-28">
          <div className={sectionLabel}>
            <span className={sectionNumber}>07</span> Comece um projeto
          </div>
          <h2 className={`${serifTitle} mt-10 text-[clamp(3.2rem,6vw,6.8rem)]`}>
            Qual ideia você quer
            <br />
            <i className="font-normal text-[#fffdf8]">tirar do papel?</i>
          </h2>
        </div>
        <div className="m-3 flex flex-col justify-center rounded-[1.5rem] border border-white/50 bg-white/40 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl sm:p-10">
          <p className="text-sm leading-7">
            Conte um pouco sobre o que deseja criar. Quanto mais detalhes,
            melhor será o primeiro orçamento.
          </p>
          <a
            href="https://wa.me/5516997432741"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex items-center justify-between rounded-full bg-[#0b2447] py-3 pr-3 pl-6 font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Pedir orçamento{" "}
            <span className="grid size-10 place-items-center rounded-full bg-[#d8bc7b] text-xl text-[#0b2447]">
              →
            </span>
          </a>
          <small className="mt-5 text-[0.65rem] leading-5 text-[#0b2447]/65">
            Atendimento personalizado · Projetos únicos · Envio para todo o
            Brasil
          </small>
        </div>
      </section>

      <footer className="flex flex-col items-start justify-between gap-8 px-6 py-12 text-sm sm:px-10 lg:flex-row lg:items-end">
        <div>
          <a className="flex flex-col leading-none" href="#inicio">
            <b className="font-serif text-3xl font-normal tracking-[0.08em]">
              Artgian
            </b>
            <span className="mt-2 text-[0.55rem] font-bold uppercase tracking-[0.55em]">
              studio
            </span>
          </a>
          <p className="mt-5 text-[#647087]">
            Soluções criativas em impressão 3D.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 font-semibold">
          <a className="hover:text-[#b88a3b]" href="#produtos">
            Produtos
          </a>
          <a className="hover:text-[#b88a3b]" href="#personalizados">
            Personalizados
          </a>
          <a className="hover:text-[#b88a3b]" href="#como-funciona">
            Processo
          </a>
          <a className="hover:text-[#b88a3b]" href="#orcamento">
            Contato
          </a>
        </nav>
        <small className="text-[#647087]">© 2026 Artgian Studio</small>
      </footer>
    </main>
  );
}
