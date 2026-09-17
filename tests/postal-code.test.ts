import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/addresses/lookup/route";

const lookup = (cep: string) => GET(new Request(`https://store.test/api/addresses/lookup?cep=${encodeURIComponent(cep)}`));
const address = { cep: "01001-000", logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" };
afterEach(() => vi.unstubAllGlobals());

describe("postal code lookup", () => {
  it("rejects malformed input without contacting the provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const cep of ["", "123", "010010000", "01001abc", "https://evil.test"])
      expect((await lookup(cep)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("normalizes the CEP and returns only address fields with caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...address, complemento: "lado ímpar" }));
    vi.stubGlobal("fetch", fetcher);
    const response = await lookup("01001-000");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ address: { streetAddress: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP" } });
    expect(fetcher).toHaveBeenCalledWith("https://viacep.com.br/ws/01001000/json/", expect.objectContaining({ signal: expect.any(AbortSignal), next: { revalidate: 86400 } }));
    expect(response.headers.get("cache-control")).toContain("max-age");
  });
  it("allows general CEPs without a street or neighborhood", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...address, logradouro: "", bairro: "" })));
    expect((await lookup("01001000")).status).toBe(200);
  });
  it.each([true, "true"])("handles missing CEP with erro=%s", async erro => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ erro })));
    expect((await lookup("99999999")).status).toBe(404);
  });
  it("handles provider errors, timeouts, invalid JSON and unexpected data", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new DOMException("Timeout", "TimeoutError"))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("not json"))
      .mockResolvedValueOnce(Response.json({ ...address, uf: "ZZ" }))
      .mockResolvedValueOnce(Response.json({ ...address, cep: "01310-100" }));
    vi.stubGlobal("fetch", fetcher);
    for (let index = 0; index < 5; index++) {
      const response = await lookup("01001000");
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("manualmente");
    }
  });
});
