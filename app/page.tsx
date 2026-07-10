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
      </div>
    </main>
  );
}
