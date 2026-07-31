export type SeasonalCampaign = {
  navigationLabel: string;
  eyebrow: string;
  title: string;
  accentTitle: string;
  description: string;
  cta: string;
  meta: string;
  href: string;
  image: string;
  imageAlt: string;
  badge: string;
  contact: {
    eyebrow: string;
    description: string;
    cta: string;
    href: string;
  };
};

export const seasonalCampaign: SeasonalCampaign = {
  navigationLabel: "Dia dos Pais",
  eyebrow: "Presente em destaque · Dia dos Pais",
  title: "Kit especial",
  accentTitle: "Dia dos Pais.",
  description:
    "Suporte para lata de 350 ml, chaveiro, cartão e embalagem premium reunidos em um presente cheio de significado.",
  cta: "Conhecer a edição",
  meta: "R$ 39,90 · Feito sob encomenda",
  href: "/dia-dos-pais",
  image: "/dia-dos-pais-capa-uhd.jpg",
  imageAlt:
    "Kit de Dia dos Pais com suporte para lata, chaveiro, cartão e caixa presente",
  badge: "Feito com carinho",
  contact: {
    eyebrow: "Quer algo ainda mais pessoal?",
    description: "Também criamos presentes personalizados para o seu pai.",
    cta: "Falar com a Artgian",
    href: "https://wa.me/5516997432741?text=Ol%C3%A1%2C%20gostaria%20de%20personalizar%20um%20presente%20de%20Dia%20dos%20Pais.",
  },
};
