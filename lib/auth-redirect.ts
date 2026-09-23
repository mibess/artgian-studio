export function safeReturnTo(value?: string) {
  // Keep authentication redirects within customer-facing store routes.
  if (!value || /[\\\r\n]/.test(value)) return "/conta";
  try {
    const url = new URL(value, "https://store.invalid");
    if (
      !value.startsWith("/") ||
      url.origin !== "https://store.invalid" ||
      (!["/comprar", "/comprar/pagamento", "/carrinho", "/conta", "/produtos"].includes(url.pathname) &&
        !/^\/conta\/pedidos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname))
    )
      return "/conta";
    return url.pathname + url.search;
  } catch {
    return "/conta";
  }
}
