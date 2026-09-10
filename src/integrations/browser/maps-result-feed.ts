import type { Page } from "playwright-core";
import {
  mapsBusinessKey,
  type LocalStopReason,
} from "../../features/outbound/local-discovery-domain";
import { randomInteger } from "../../features/automation/human-pacing";
import { pauseLikePerson } from "./human-pacing";

export type MapsFeedDriver = {
  read: () => Promise<{
    urls: string[];
    end: boolean;
    available: boolean;
    position?: number;
  }>;
  scroll: () => Promise<void>;
};

export function mapsFeedDriver(page: Page): MapsFeedDriver {
  return {
    read: async () =>
      page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        const singlePlace =
          !feed &&
          location.pathname.startsWith("/maps/place/") &&
          !!document.querySelector("h1");
        const root = feed || document;
        return {
          urls: singlePlace
            ? [location.href]
            : feed
              ? Array.from(
                  feed.querySelectorAll('a[href*="/maps/place/"]'),
                ).map((anchor) => (anchor as HTMLAnchorElement).href)
              : [],
          position: feed?.scrollTop || 0,
          available: !!feed || singlePlace,
          end:
            !!singlePlace ||
            /(?:Você chegou ao final da lista|Você chegou ao fim da lista|You.ve reached the end of the list|Nenhum resultado encontrado|No results found)/i.test(
              root.textContent || "",
            ),
        };
      }),
    scroll: async () => {
      await page
        .locator('[role="feed"]')
        .evaluate(
          (feed, distance) => {
            feed.scrollBy({ top: distance, behavior: "smooth" });
          },
          randomInteger(450, 800),
        )
        .catch(() => undefined);
      await pauseLikePerson(page, {
        minimumVariable: "DISCOVERY_MIN_RESULTS_WAIT_SECONDS",
        maximumVariable: "DISCOVERY_MAX_RESULTS_WAIT_SECONDS",
        defaultMinimumSeconds: 4,
        defaultMaximumSeconds: 8,
      });
    },
  };
}

// Keep the list tab intact while details are opened elsewhere. Persist every newly
// loaded batch before inspecting it, including rows beyond this execution's quota.
export class MapsResultFeed {
  private pending: string[] = [];
  private seen = new Set<string>();
  private excluded: Set<string>;
  private ended = false;
  private stagnant = 0;
  private lastPosition = 0;
  stopReason: LocalStopReason | null = null;
  scrolls = 0;
  skippedKnownBusinesses = 0;

  constructor(
    private input: {
      driver: MapsFeedDriver;
      pendingUrls: string[];
      excludedUrls: string[];
      maximumScrolls: number;
      deadline: number;
      onLinks?: (urls: string[]) => Promise<void>;
    },
  ) {
    this.excluded = new Set(
      input.excludedUrls.flatMap((url) => mapsBusinessKey(url) || []),
    );
    this.add(input.pendingUrls);
  }

  private add(urls: string[]) {
    const added: string[] = [];
    for (const url of urls) {
      const key = mapsBusinessKey(url);
      if (!key || this.seen.has(key)) continue;
      this.seen.add(key);
      if (this.excluded.has(key)) {
        this.skippedKnownBusinesses += 1;
        continue;
      }
      const absolute = new URL(url, "https://www.google.com").toString();
      this.pending.push(absolute);
      added.push(absolute);
    }
    return added;
  }

  get linksSeen() {
    return this.seen.size;
  }
  get pendingCount() {
    return this.pending.length;
  }

  async next(): Promise<string | null> {
    while (true) {
      if (Date.now() >= this.input.deadline) {
        this.stopReason = "time_limit";
        return null;
      }
      if (this.pending.length) return this.pending.shift()!;
      if (this.ended) {
        this.stopReason = "list_end";
        return null;
      }
      const before = this.seen.size;
      const snapshot = await this.input.driver.read();
      const added = this.add(snapshot.urls);
      if (added.length) await this.input.onLinks?.(added);
      this.ended = snapshot.end;
      this.stagnant =
        this.seen.size > before || (snapshot.position ?? 0) > this.lastPosition
          ? 0
          : this.stagnant + 1;
      this.lastPosition = snapshot.position ?? 0;
      if (this.pending.length || this.ended) continue;
      if (this.stagnant >= 4) {
        this.stopReason = snapshot.available ? "no_new_results" : "load_failed";
        return null;
      }
      if (this.scrolls >= this.input.maximumScrolls) {
        this.stopReason = "scroll_limit";
        return null;
      }
      await this.input.driver.scroll();
      this.scrolls += 1;
    }
  }
}
