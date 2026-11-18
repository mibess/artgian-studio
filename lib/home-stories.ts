export const storyProducts = {
  "kit-natalino-trico": "Kit Natalino Tricô",
  "kit-de-natal-grinch": "Kit de Natal Grinch",
  "enfeite-natalino-letreiro-feliz-natal": "Letreiro Feliz Natal",
  "organizador-arco": "Organizador Arco",
  "bandeja-aurora": "Bandeja Aurora",
  "porta-palhetas-solo": "Porta-Palhetas Solo",
  "porta-incenso-samurai": "Porta-Incenso Samurai",
  "suporte-pocket": "Suporte Pocket",
} as const;

export type StoryProduct = keyof typeof storyProducts;

type HomeStory = {
  title: string;
  product: StoryProduct;
  image: string;
  video?: string;
};

export const homeStories: HomeStory[] = [
  {
    title: "Arrumando o Natal", product: "kit-natalino-trico",
    image: "/artgian-em-casa/trico-aparador.webp", video: "/artgian-em-casa/trico-aparador.mp4",
  },
  { title: "O Natal do Grinch", product: "kit-de-natal-grinch", image: "/avaliacoes/kit-de-natal-grinch.webp" },
  {
    title: "Boas-vindas na entrada", product: "enfeite-natalino-letreiro-feliz-natal",
    image: "/artgian-em-casa/letreiro-mesa.webp", video: "/artgian-em-casa/letreiro-mesa.mp4",
  },
  {
    title: "O lugar das chaves", product: "bandeja-aurora",
    image: "/artgian-em-casa/aurora-pegando-chaves.webp", video: "/artgian-em-casa/aurora-pegando-chaves.mp4",
  },
  {
    title: "À mesa da ceia", product: "kit-natalino-trico",
    image: "/artgian-em-casa/ceia-em-familia.webp", video: "/artgian-em-casa/ceia-em-familia.mp4",
  },
  {
    title: "Na escrivaninha", product: "organizador-arco",
    image: "/artgian-em-casa/arco-na-mesa-de-trabalho.webp",
  },
  {
    title: "Hora do violão", product: "porta-palhetas-solo",
    image: "/artgian-em-casa/solo-ao-lado-do-violao.webp",
  },
];
