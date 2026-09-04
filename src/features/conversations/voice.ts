const THIRD_PERSON_BRAND_VERBS: Record<string, string> = {
  aceita: "aceita",
  cria: "cria",
  desenvolve: "desenvolve",
  faz: "faz",
  oferece: "oferece",
  personaliza: "personaliza",
  produz: "produz",
  trabalha: "trabalha",
  transforma: "transforma",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function naturalizeBrandVoice(message: string, companyName: string) {
  const verbs = Object.keys(THIRD_PERSON_BRAND_VERBS).join("|");
  const company = escapeRegExp(companyName.trim());
  if (!company) return message.trim();
  return message
    .replace(
      new RegExp(`\\b(?:a\\s+)?${company}\\s+(${verbs})\\b`, "giu"),
      (_match, verb: string) => `a gente ${THIRD_PERSON_BRAND_VERBS[verb.toLocaleLowerCase("pt-BR")] || verb}`,
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^a gente\b/u, "A gente");
}

export const NATURAL_CONVERSATION_GUIDELINES = [
  "Escreva como uma pessoa da equipe conversando pelo Instagram, com transparência e sem fingir ser cliente.",
  "Fale em primeira pessoa: prefira 'eu', 'a gente' e 'por aqui'. Nunca narre a marca em terceira pessoa, como 'A Artgian Studio faz' ou 'A Artgian Studio personaliza'.",
  "Use frases simples, curtas e espontâneas. Evite linguagem de atendimento, texto publicitário e expressões burocráticas como 'encaminhar sua solicitação'.",
  "Não repita cumprimento quando a conversa já começou e não repita informações que a pessoa acabou de fornecer.",
  "Acompanhe o grau de informalidade da pessoa, sem exagerar em emojis, exclamações, diminutivos ou gírias.",
  "Faça no máximo uma pergunta por mensagem e nunca invente experiência pessoal, elogio ou observação que não esteja no contexto.",
].join(" ");
