import { z } from "zod";
import { BRAZIL_STATES } from "../../../../lib/addresses/schema";

const resultSchema = z.object({
  cep: z.string(),
  logradouro: z.string().max(180),
  bairro: z.string().max(80),
  localidade: z.string().min(1).max(80),
  uf: z.enum(BRAZIL_STATES),
});

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("cep") ?? "";
  if (!/^\d{5}-?\d{3}$/.test(input))
    return Response.json({ error: "Informe um CEP válido com 8 dígitos." }, { status: 400 });
  const cep = input.replace("-", "");
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("ViaCEP unavailable");
    const data = await response.json();
    if (data?.erro === true || data?.erro === "true")
      return Response.json({ error: "CEP não encontrado. Preencha o endereço manualmente." }, { status: 404 });
    const result = resultSchema.parse(data);
    if (result.cep.replace(/\D/g, "") !== cep) throw new Error("Unexpected postal code");
    return Response.json({ address: {
      streetAddress: result.logradouro,
      neighborhood: result.bairro,
      city: result.localidade,
      state: result.uf,
    } }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "Consulta de CEP indisponível. Preencha o endereço manualmente." }, { status: 503 });
  }
}
