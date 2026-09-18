globalThis.fetch = async (url, init = {}) => {
  if (!String(url).startsWith("https://api.mercadopago.com/")) throw new Error("Unexpected external request in test");
  if (String(url).includes("/v1/payments/search")) return Response.json({ results: [], paging: { total: 0 } });
  if (init.method === "PUT") return Response.json(JSON.parse(init.body));
  return Response.json({ external_reference: "2d4481d6-test", expires: true, expiration_date_to: "2020-01-01T00:00:00Z" });
};
