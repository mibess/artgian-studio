export default function Home() {
  return (
    <main>
      <aside className="side-rail" aria-label="Navegação por seções">
        <span className="spark" aria-hidden="true">✦</span>
        <span className="rail-line" />
        <nav>
          <a href="#produtos">Produtos</a>
          <a href="#personalizados">Personalizados</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#sobre">Sobre</a>
        </nav>
        <span className="cube-mark" aria-hidden="true">◇</span>
      </aside>

      <div className="site-shell">
        <header className="topbar">
          <a className="brand" href="#inicio" aria-label="Artgian Studio — início">
            <span className="brand-symbol"><img src="/artgian-logo.jpeg" alt="" /></span>
            <span className="brand-name"><b>Artgian</b><small>studio</small></span>
          </a>
          <nav className="top-actions" aria-label="Ações principais">
            <a className="round-link round-link--dark" href="#orcamento">
              <span aria-hidden="true">→</span> Pedir orçamento
            </a>
            <a className="round-link" href="#produtos">
              <span aria-hidden="true">→</span> Ver criações
            </a>
          </nav>
        </header>

        <section className="hero" id="inicio">
          <div className="eyebrow">Impressão 3D <i /> Feito sob medida</div>
          <h1>
            Ideias ganham <span>forma.</span> Detalhes
            <strong> viram memória.</strong>
          </h1>
          <div className="hero-gallery" aria-label="Galeria de criações Artgian Studio">
            <img src="/hero-gallery.png" alt="Chaveiro de ursinho, escultura, luminária e miniatura impressos em 3D" />
            <a className="hero-cta" href="#orcamento">
              <span aria-hidden="true">◇</span>
              Pedir<br />orçamento
            </a>
            <div className="gallery-count"><b>01</b><i /><span>03</span></div>
          </div>

          <div className="process-strip" aria-label="Etapas do processo">
            <article><b>01</b><div><strong>Você imagina</strong><span>Sua ideia, seu propósito.</span></div></article>
            <em>→</em>
            <article><b>02</b><div><strong>Projetamos juntos</strong><span>Do conceito ao detalhe.</span></div></article>
            <em>→</em>
            <article><b>03</b><div><strong>Produzimos com precisão</strong><span>Impressão 3D de alta fidelidade.</span></div></article>
            <em>→</em>
            <article><b>04</b><div><strong>Entregamos memórias</strong><span>Peças únicas, feitas para durar.</span></div></article>
          </div>
        </section>

        <section className="manifesto" id="sobre">
          <div className="section-kicker"><span>02</span> Nossa essência</div>
          <p className="manifesto-lead">Entre o que você imagina e o que pode tocar, existe um processo.</p>
          <h2>Transformamos o extraordinário em <em>forma.</em></h2>
          <div className="manifesto-foot">
            <p>Unimos desenho, tecnologia e acabamento cuidadoso para criar objetos que carregam significado.</p>
            <span>Precisão no processo.<br />Personalidade no resultado.</span>
          </div>
        </section>

        <section className="collection" id="produtos">
          <header className="section-heading">
            <div className="section-kicker"><span>03</span> Criações em destaque</div>
            <h2>Uma galeria de<br /><i>possibilidades.</i></h2>
            <p>Peças decorativas, presentes, miniaturas e soluções funcionais feitas camada por camada.</p>
          </header>
          <div className="collection-grid">
            <article className="product-card product-card--wide">
              <div className="product-crop product-crop--lamp"><img src="/hero-gallery.png" alt="Luminária escultórica impressa em 3D" /></div>
              <span>01 / Iluminação</span><h3>Luz que também decora.</h3>
            </article>
            <article className="product-card">
              <div className="product-crop product-crop--bear"><img src="/hero-gallery.png" alt="Chaveiro de ursinho impresso em 3D" /></div>
              <span>02 / Presentes</span><h3>Pequenos objetos, grandes histórias.</h3>
            </article>
            <article className="product-card">
              <div className="product-crop product-crop--figure"><img src="/hero-gallery.png" alt="Miniatura detalhada impressa em 3D" /></div>
              <span>03 / Colecionáveis</span><h3>Detalhes que dão vida à imaginação.</h3>
            </article>
          </div>
        </section>

        <section className="personalized" id="personalizados">
          <div className="personalized-image">
            <img src="/personalized-gifts.png" alt="Presentes personalizados produzidos pela Artgian Studio" />
            <span className="image-note">Feito especialmente<br />para alguém.</span>
          </div>
          <div className="personalized-copy">
            <div className="section-kicker"><span>04</span> Personalizados</div>
            <h2>Não é apenas um objeto. <i>É a sua ideia.</i></h2>
            <p>Do nome na peça à criação de um formato exclusivo, cada projeto começa com uma conversa e termina com algo que só poderia ser seu.</p>
            <ul>
              <li><span>01</span> Lembranças para eventos e celebrações</li>
              <li><span>02</span> Presentes com nomes, frases e símbolos</li>
              <li><span>03</span> Protótipos e pequenas séries</li>
              <li><span>04</span> Decoração e organização sob medida</li>
            </ul>
            <a className="text-link" href="#orcamento">Criar uma peça personalizada <b>→</b></a>
          </div>
        </section>

        <section className="how" id="como-funciona">
          <div className="how-copy">
            <div className="section-kicker section-kicker--light"><span>05</span> Como funciona</div>
            <h2>Da primeira conversa à <i>última camada.</i></h2>
            <div className="steps">
              <article><span>01</span><div><h3>Conte a sua ideia</h3><p>Envie uma referência, um desenho ou simplesmente explique o que você imaginou.</p></div></article>
              <article><span>02</span><div><h3>Ajustamos o projeto</h3><p>Definimos dimensões, cores, material e acabamento antes da produção.</p></div></article>
              <article><span>03</span><div><h3>Produzimos e entregamos</h3><p>Sua peça é impressa, revisada e preparada com todo o cuidado.</p></div></article>
            </div>
          </div>
          <div className="how-image"><img src="/process-printing.png" alt="Impressora 3D criando uma peça em camadas" /><span>Precisão<br />camada a camada</span></div>
        </section>

        <section className="values">
          <div className="section-kicker"><span>06</span> Por que Artgian</div>
          <div className="values-grid">
            <h2>Design com propósito.<br /><i>Produção com cuidado.</i></h2>
            <article><b>◇</b><h3>Criação próxima</h3><p>Você participa das escolhas para que o resultado tenha a sua identidade.</p></article>
            <article><b>✦</b><h3>Detalhe visível</h3><p>Cada camada faz parte da estética e recebe atenção do início ao acabamento.</p></article>
            <article><b>○</b><h3>Feito para durar</h3><p>Materiais selecionados e produção consciente, sem excessos ou desperdícios.</p></article>
          </div>
        </section>

        <section className="quote" id="orcamento">
          <div className="quote-copy">
            <div className="section-kicker"><span>07</span> Comece um projeto</div>
            <h2>Qual ideia você quer<br /><i>tirar do papel?</i></h2>
          </div>
          <div className="quote-card">
            <p>Conte um pouco sobre o que deseja criar. Quanto mais detalhes, melhor será o primeiro orçamento.</p>
            <a href="mailto:contato@artgianstudio.com.br?subject=Quero%20criar%20uma%20peça%203D" className="quote-button">Pedir orçamento <span>→</span></a>
            <small>Atendimento personalizado · Projetos únicos · Envio para todo o Brasil</small>
          </div>
        </section>

        <footer>
          <a className="footer-brand" href="#inicio"><b>Artgian</b><span>studio</span></a>
          <p>Soluções criativas em impressão 3D.</p>
          <nav><a href="#produtos">Produtos</a><a href="#personalizados">Personalizados</a><a href="#como-funciona">Processo</a><a href="#orcamento">Contato</a></nav>
          <small>© 2026 Artgian Studio</small>
        </footer>
      </div>
    </main>
  );
}
