import type { StoryProduct } from "./home-stories";

export type HomeReview = {
  author: string;
  product: StoryProduct;
  stars: 1 | 2 | 3 | 4 | 5;
  text: string;
  photo?: { src: string; alt: string; width: number; height: number };
};

// Editorial examples for the preview. Replace with customer-approved reviews.
export const exampleReviews: HomeReview[] = [
  {
    author: "Lívia Monteiro", product: "kit-natalino-trico", stars: 5,
    photo: {
      src: "/avaliacoes/trico-na-sala.webp",
      alt: "Kit Natalino Tricô no rack da sala, ao lado do controle da TV.",
      width: 900, height: 1200,
    },
    text: "A reninha é a minha preferida!",
  },
  {
    author: "Paula", product: "organizador-arco", stars: 4,
    photo: {
      src: "/avaliacoes/arco-na-comoda.webp",
      alt: "Organizador Arco areia e branco na cômoda junto ao espelho.",
      width: 850, height: 1133,
    },
    text: "As gavetinhas são boas. Queria uma mais funda.",
  },
  {
    author: "Cecília Rocha", product: "bandeja-aurora", stars: 5,
    photo: {
      src: "/avaliacoes/aurora-chaves-mao.webp",
      alt: "Uma mão segura o chaveiro sobre a Bandeja Aurora areia no móvel da entrada.",
      width: 764, height: 1024,
    },
    text: "Agora acho a chave de casa! A bandeja é bem bonita, recomendo.",
  },
  {
    author: "Bianca S.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    photo: {
      src: "/avaliacoes/letreiro-presepio.webp",
      alt: "Letreiro Feliz Natal ao lado de um presépio no aparador de madeira, com uma guirlanda na parede.",
      width: 718, height: 724,
    },
    text: "Coloquei na entrada de casa. Ficou uma graça!",
  },
  {
    author: "Felipe Ramos", product: "porta-palhetas-solo", stars: 5,
    photo: {
      src: "/avaliacoes/solo-felipe-na-sala.webp",
      alt: "Porta-Palhetas Solo de Felipe com três palhetas em âmbar, verde e marfim, ao lado do sofá.",
      width: 900, height: 900,
    },
    text: "Minhas palhetas viviam no sofá. Agora guardo todas aqui.",
  },
  {
    author: "Nina", product: "organizador-arco", stars: 5,
    photo: {
      src: "/avaliacoes/arco-cabelo-em-casa.webp",
      alt: "Organizador Arco rosa na penteadeira com piranha e elástico de cabelo nos nichos.",
      width: 764, height: 1024,
    },
    text: "Coube até a minha piranha de cabelo!",
  },
  {
    author: "Sílvia de Freitas", product: "kit-natalino-trico", stars: 5,
    photo: {
      src: "/avaliacoes/trico-rena-mao.webp",
      alt: "Uma mão segura a rena do Kit Natalino Tricô, com as outras quatro peças na bandeja ao fundo.",
      width: 881, height: 887,
    },
    text: "De pertinho parece tricô mesmo.",
  },
  {
    author: "Joana", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    photo: {
      src: "/avaliacoes/letreiro-janela-apto.webp",
      alt: "Letreiro Feliz Natal no móvel de madeira junto à janela do apartamento, com vista para a cidade.",
      width: 718, height: 724,
    },
    text: "Deixei na janela e ficou uma graça.",
  },
  {
    author: "Ícaro Martins", product: "porta-incenso-samurai", stars: 5,
    photo: {
      src: "/avaliacoes/samurai-em-casa.webp",
      alt: "Porta-Incenso Samurai preto com a vareta inclinada sobre a bandeja comprida.",
      width: 900, height: 900,
    },
    text: "O detalhe que mais gostei foi a vareta ficar parecendo a espada do samurai. Ficou bonito na estante.",
  },
  {
    author: "Lara", product: "bandeja-aurora", stars: 5,
    photo: {
      src: "/avaliacoes/aurora-joias-quarto.webp",
      alt: "Brincos dourados e anel na Bandeja Aurora rosa, sobre uma mesa de cabeceira com puxador dourado.",
      width: 764, height: 1024,
    },
    text: "Tiro os brincos e já deixo ali.",
  },
  {
    author: "Marcelo Teixeira", product: "porta-palhetas-solo", stars: 5,
    photo: {
      src: "/avaliacoes/solo-marcelo-no-estudio.webp",
      alt: "Porta-Palhetas Solo preto de Marcelo com quatro palhetas em lilás, grafite, transparente e roxo mesclado na mesa de gravação.",
      width: 700, height: 875,
    },
    text: "O formato de guitarra ficou muito legal.",
  },
  {
    author: "Taís", product: "organizador-arco", stars: 5,
    photo: {
      src: "/avaliacoes/arco-mesa-gato.webp",
      alt: "Gato tigrado descansando ao lado do Organizador Arco marrom na escrivaninha.",
      width: 900, height: 1200,
    },
    text: "O marrom combinou com a minha mesa.",
  },
  {
    author: "Luana", product: "suporte-pocket", stars: 5,
    photo: {
      src: "/avaliacoes/pocket-compacto-na-mesa.webp",
      alt: "Suporte Pocket preto aberto na escrivaninha, ao lado do celular e de um caderno.",
      width: 900, height: 900,
    },
    text: "Uso pra apoiar o celular enquanto estudo. Quando termino, dobro e guardo no estojo.",
  },
  {
    author: "Bruna Esquivel", product: "kit-natalino-trico", stars: 5,
    photo: {
      src: "/avaliacoes/trico-ceia-quebra-nozes.webp",
      alt: "Kit Natalino Tricô na mesa da ceia, junto de um soldadinho quebra-nozes e uma taça com bolas vermelhas.",
      width: 881, height: 887,
    },
    text: "Enfeitou a mesa da ceia sem ocupar muito espaço.",
  },
  {
    author: "Helena", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    photo: {
      src: "/avaliacoes/letreiro-estante.webp",
      alt: "Letreiro Feliz Natal em um nicho de madeira entre os livros e uma tigela de cerâmica azul.",
      width: 718, height: 724,
    },
    text: "Ficou lindo entre os livros da estante.",
  },
  {
    author: "Camila A.", product: "kit-natalino-trico", stars: 4,
    text: "Os bichinhos são lindos. Achei a bandeja um pouco pequena.",
  },
  {
    author: "Murilo F.", product: "porta-palhetas-solo", stars: 5,
    text: "Gostei de ver minhas palhetas todas enfileiradas.",
  },
  {
    author: "Carolina P.", product: "organizador-arco", stars: 5,
    text: "As presilhas da minha filha cabem direitinho.",
  },
  {
    author: "Nicole A.", product: "kit-natalino-trico", stars: 5,
    text: "Meu filho escolheu o ursinho pra ele.",
  },
  {
    author: "Amanda D.", product: "kit-natalino-trico", stars: 5,
    text: "O boneco de neve ficou muito fofo!",
  },
  {
    author: "Marta O.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    text: "Pus atrás das travessas na ceia. Deu pra ver de longe.",
  },
  {
    author: "Sofia Q.", product: "bandeja-aurora", stars: 5,
    text: "Linda, até quando tá vazia.",
  },
  {
    author: "Breno R.", product: "organizador-arco", stars: 5,
    text: "Era disso que eu precisava pros cartões de memória.",
  },
  {
    author: "Luana Costa", product: "porta-palhetas-solo", stars: 5,
    text: "Deixo do lado do violão. Ajuda muito na aula.",
  },
  {
    author: "Alice P.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    text: "Minha vó já pediu um igual!",
  },
  {
    author: "Júlio V.", product: "kit-natalino-trico", stars: 5,
    text: "O detalhe da estrela é uma fofura.",
  },
  {
    author: "Rafael L.", product: "bandeja-aurora", stars: 4,
    text: "Bonita, só queria a borda um pouco mais alta.",
  },
  {
    author: "Vera L.", product: "organizador-arco", stars: 5,
    text: "Agora cada cor de botão tem sua gavetinha.",
  },
  {
    author: "Caio S.", product: "bandeja-aurora", stars: 5,
    text: "Deixo os óculos nela antes de dormir.",
  },
  {
    author: "Olívia T.", product: "porta-palhetas-solo", stars: 5,
    text: "Meu irmão já colocou as palhetas preferidas dele.",
  },
  {
    author: "Renata B.", product: "kit-natalino-trico", stars: 5,
    text: "Os gorrinhos ficaram uma graça.",
  },
  {
    author: "Débora R.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    text: "Gostei do vermelho, dá pra ver logo que entra.",
  },
  {
    author: "Estela N.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    text: "Deu um toque de Natal pro rack.",
  },
  {
    author: "Danilo G.", product: "organizador-arco", stars: 5,
    text: "As gavetinhas deslizam bem.",
  },
  {
    author: "Priscila H.", product: "bandeja-aurora", stars: 5,
    text: "Cheguei da rua, já largo a chave do portão ali.",
  },
  {
    author: "Samuel J.", product: "porta-palhetas-solo", stars: 5,
    text: "Cabe do ladinho do afinador.",
  },
  {
    author: "Milena C.", product: "organizador-arco", stars: 5,
    text: "A gaveta de baixo virou a dos grampos.",
  },
  {
    author: "Leonardo K.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 4,
    text: "Gostei da letra. No meu móvel escuro ela aparece pouco.",
  },
  {
    author: "Isadora E.", product: "kit-natalino-trico", stars: 5,
    text: "O Papai Noel foi o favorito aqui de casa.",
  },
  {
    author: "Adriana Q.", product: "bandeja-aurora", stars: 5,
    text: "Uso pra deixar meus anéis quando vou cozinhar.",
  },
  {
    author: "Davi A.", product: "organizador-arco", stars: 5,
    text: "Comprei pra mim, minha filha pegou pra ela kkk",
  },
  {
    author: "Melissa V.", product: "porta-palhetas-solo", stars: 5,
    text: "Finalmente tirei minhas palhetas da latinha.",
  },
  {
    author: "Mônica U.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    text: "Fica em pé sem precisar encostar na parede.",
  },
  {
    author: "Jorge V.", product: "bandeja-aurora", stars: 5,
    text: "Deixo o troco e a chave juntos agora.",
  },
  {
    author: "Yasmin Z.", product: "kit-natalino-trico", stars: 5,
    text: "Combinou com o presépio da minha mãe.",
  },
  {
    author: "Otávio F.", product: "porta-palhetas-solo", stars: 4,
    text: "Gostei, só queria espaço pra mais umas palhetas.",
  },
  {
    author: "Jéssica R.", product: "organizador-arco", stars: 5,
    text: "Guardei elástico, grampo e ainda sobrou espaço.",
  },
  {
    author: "Elisa C.", product: "bandeja-aurora", stars: 5,
    text: "Era o que faltava na minha cômoda.",
  },
  {
    author: "Natália B.", product: "kit-natalino-trico", stars: 5,
    text: "Meu sobrinho ficou encantado com a árvore.",
  },
  {
    author: "Pedro M.", product: "kit-natalino-trico", stars: 5,
    text: "Dá pra levar tudo junto na bandejinha.",
  },
  {
    author: "Raquel B.", product: "enfeite-natalino-letreiro-feliz-natal", stars: 5,
    text: "Ficou bem bonito nas fotos do Natal.",
  },
  {
    author: "Artur N.", product: "porta-palhetas-solo", stars: 5,
    text: "Deixei à mostra as palhetas que trouxe dos shows.",
  },
  {
    author: "Denise P.", product: "bandeja-aurora", stars: 5,
    text: "Couberam meu relógio e os anéis de todo dia.",
  },
  {
    author: "Lorena G.", product: "kit-natalino-trico", stars: 5,
    text: "As crianças adoraram arrumar os bichinhos ❤️",
  },
];

// Keep these out of the preview until the Grinch review photo is ready.
export const archivedGrinchReviews = [
  {
    author: "André L.", product: "kit-de-natal-grinch", stars: 4,
    text: "Gostei do kit, só achei o Max pequenininho.",
  },
  {
    author: "Hugo C.", product: "kit-de-natal-grinch", stars: 5,
    text: "Adorei essa árvore toda tortinha kkk",
  },
  {
    author: "Fábio D.", product: "kit-de-natal-grinch", stars: 5,
    text: "Dei pra minha esposa, ela já arrumou um lugar na sala.",
  },
  {
    author: "Gustavo H.", product: "kit-de-natal-grinch", stars: 5,
    text: "Coube direitinho entre os livros.",
  },
  {
    author: "Eduarda F.", product: "kit-de-natal-grinch", stars: 4,
    text: "Gostei dos personagens, mas imaginei que fossem maiores.",
  },
  {
    author: "Vinícius D.", product: "kit-de-natal-grinch", stars: 5,
    text: "Ficou ótimo junto dos meus quadrinhos.",
  },
  {
    author: "Beatriz O.", product: "kit-de-natal-grinch", stars: 5,
    text: "Essa cara de poucos amigos me ganhou 😂",
  },
  {
    author: "Henrique I.", product: "kit-de-natal-grinch", stars: 5,
    text: "Só depois reparei na bolinha da árvore. Muito legal!",
  },
  {
    author: "Marina L.", product: "kit-de-natal-grinch", stars: 5,
    text: "A poltroninha vermelha é linda demais.",
  },
] as const;
