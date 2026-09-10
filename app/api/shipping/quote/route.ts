import { checkoutItems } from "../../../../lib/cart";
import {
  normalizePostalCode,
  ShippingConfigurationError,
  ShippingProviderError,
} from "../../../../lib/melhor-envio";
import { quoteCartShipping } from "../../../../lib/shipping";

type QuotePayload = {
  items?: unknown;
  productId?: string;
  color?: string;
  quantity?: number;
  personalization?: string;
  postalCode?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as QuotePayload;
    if (!payload || typeof payload !== "object")
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    const postalCode = normalizePostalCode(payload.postalCode);

    if (postalCode.length !== 8) {
      return Response.json(
        { error: "Informe um CEP válido." },
        { status: 400 },
      );
    }

    const items = checkoutItems(payload);
    if (!items?.length)
      return Response.json({ error: "Carrinho inválido." }, { status: 400 });
    const quote = await quoteCartShipping(items, postalCode);

    return Response.json(
      {
        postalCode,
        options: quote.options,
        quotedAt: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    if (error instanceof ShippingConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof ShippingProviderError) {
      const status = error.status >= 400 && error.status < 500 ? 422 : 502;
      return Response.json({ error: error.message }, { status });
    }

    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "O cálculo de frete demorou demais. Tente novamente."
        : "Não foi possível calcular o frete agora.";
    return Response.json({ error: message }, { status: 502 });
  }
}
