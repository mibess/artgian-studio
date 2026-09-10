import { describe, expect, it, vi } from "vitest";
import { MapsResultFeed } from "../src/integrations/browser/maps-result-feed";
import {
  localDiscoveryQueryKey,
  localProgressSummary,
  mapsBusinessKey,
} from "../src/features/outbound/local-discovery-domain";

const url = (id: number) =>
  `https://www.google.com/maps/place/Empresa/data=!4m2!3m1!1s0x1:0x${id.toString(16)}`;
function fixture(
  pages: Array<{
    urls: string[];
    end?: boolean;
    available?: boolean;
    position?: number;
  }>,
  extra: Partial<ConstructorParameters<typeof MapsResultFeed>[0]> = {},
) {
  let position = 0;
  const driver = {
    read: vi.fn(async () => ({
      end: false,
      available: true,
      ...pages[Math.min(position, pages.length - 1)],
    })),
    scroll: vi.fn(async () => {
      position += 1;
    }),
  };
  const onLinks = vi.fn(async (urls: string[]) => {
    void urls;
  });
  const feed = new MapsResultFeed({
    driver,
    onLinks,
    pendingUrls: [],
    excludedUrls: [],
    maximumScrolls: 40,
    deadline: Date.now() + 60_000,
    ...extra,
  });
  return { feed, driver, onLinks };
}

describe("continuidade da lista do Maps", () => {
  it("rola além dos primeiros resultados conhecidos e salva também os excedentes", async () => {
    const { feed, driver, onLinks } = fixture(
      [{ urls: [url(1)] }, { urls: [url(1), url(2), url(3)], end: true }],
      { excludedUrls: [url(1) + "?hl=pt"] },
    );
    expect(await feed.next()).toBe(url(2));
    expect(driver.scroll).toHaveBeenCalledOnce();
    expect(onLinks).toHaveBeenCalledWith([url(2), url(3)]);
    expect(feed.pendingCount).toBe(1);
    expect(feed.skippedKnownBusinesses).toBe(1);
    expect(await feed.next()).toBe(url(3));
    expect(await feed.next()).toBeNull();
    expect(feed.stopReason).toBe("list_end");
  });
  it("retoma pendências antes de reler a lista e não reabre variantes de URL", async () => {
    const { feed, driver } = fixture(
      [{ urls: [url(1) + "?hl=en", url(2)], end: true }],
      { pendingUrls: [url(1)] },
    );
    expect(await feed.next()).toBe(url(1));
    expect(driver.read).not.toHaveBeenCalled();
    expect(await feed.next()).toBe(url(2));
    expect(await feed.next()).toBeNull();
  });
  it("aguarda carregamento tardio sem confundir ausência temporária com fim", async () => {
    const { feed } = fixture([
      { urls: [] },
      { urls: [] },
      { urls: [url(4)], end: true },
    ]);
    expect(await feed.next()).toBe(url(4));
    expect(feed.scrolls).toBe(2);
  });
  it("percorre uma lista longa de conhecidos enquanto a rolagem ainda avança", async () => {
    const pages = Array.from({ length: 8 }, (_, i) => ({
      urls: [url(1)],
      position: i * 600,
    }));
    pages.push({ urls: [url(1), url(2)], position: 4800 });
    const { feed } = fixture(pages, { excludedUrls: [url(1)] });
    expect(await feed.next()).toBe(url(2));
    expect(feed.scrolls).toBe(8);
  });
  it("lê o lote que carregou na última rolagem permitida", async () => {
    const { feed } = fixture([{ urls: [] }, { urls: [url(2)] }], {
      maximumScrolls: 1,
    });
    expect(await feed.next()).toBe(url(2));
    expect(feed.scrolls).toBe(1);
  });
  it.each([
    [true, "no_new_results"],
    [false, "load_failed"],
  ])(
    "distingue lista estagnada de falha de carregamento (%s)",
    async (available, reason) => {
      const { feed } = fixture([{ urls: [], available }]);
      expect(await feed.next()).toBeNull();
      expect(feed.stopReason).toBe(reason);
      expect(feed.scrolls).toBe(3);
    },
  );
  it("para por limite de rolagem ou tempo sem descartar a fila", async () => {
    const { feed } = fixture([{ urls: [url(1)] }, { urls: [url(2)] }], {
      maximumScrolls: 1,
      excludedUrls: [url(1), url(2)],
    });
    expect(await feed.next()).toBeNull();
    expect(feed.stopReason).toBe("scroll_limit");
    const timed = fixture([{ urls: [] }], {
      pendingUrls: [url(3)],
      deadline: Date.now() - 1,
    }).feed;
    expect(await timed.next()).toBeNull();
    expect(timed.stopReason).toBe("time_limit");
    expect(timed.pendingCount).toBe(1);
  });
  it("não prossegue se a persistência da fila falhar", async () => {
    const { feed } = fixture([{ urls: [url(1)] }], {
      onLinks: async () => {
        throw new Error("db unavailable");
      },
    });
    await expect(feed.next()).rejects.toThrow("db unavailable");
  });
  it("identifica empresas por CID/Place ID, sem juntar filiais pelo nome", () => {
    expect(mapsBusinessKey(url(123))).toBe(
      mapsBusinessKey("https://www.google.com/maps/?cid=123"),
    );
    expect(
      mapsBusinessKey(
        "https://www.google.com/maps/search/?query_place_id=ChIabc",
      ),
    ).toBe("place:ChIabc");
    expect(mapsBusinessKey("https://evil.com/maps/place/test")).toBeNull();
    expect(
      mapsBusinessKey("https://www.google.com/maps/place/Loja/@1,2,3z"),
    ).not.toBe(
      mapsBusinessKey("https://www.google.com/maps/place/Loja/@4,5,6z"),
    );
    expect(localDiscoveryQueryKey("Manicure", "Brodowski SP")).toBe(
      localDiscoveryQueryKey(" manicure ", "BRODOWSKI  SP"),
    );
    expect(localDiscoveryQueryKey("Manicure", "Brodowski")).not.toBe(
      localDiscoveryQueryKey("Mecânica", "Brodowski"),
    );
    expect(localProgressSummary("inválido")).toBeNull();
  });
});
