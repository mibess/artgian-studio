import type { Locator, Page } from "playwright-core";
import {
  randomDelayFromEnvironment,
  randomInteger,
} from "../../features/automation/human-pacing";

type PauseOptions = {
  minimumVariable: string;
  maximumVariable: string;
  defaultMinimumSeconds: number;
  defaultMaximumSeconds: number;
  absoluteMaximumSeconds?: number;
};

export async function pauseLikePerson(page: Page, options: PauseOptions) {
  const delay = randomDelayFromEnvironment({
    minimumVariable: options.minimumVariable,
    maximumVariable: options.maximumVariable,
    defaultMinimum: options.defaultMinimumSeconds,
    defaultMaximum: options.defaultMaximumSeconds,
    absoluteMinimum: 0.25,
    absoluteMaximum: options.absoluteMaximumSeconds || 60,
    unit: "seconds",
  });
  await page.waitForTimeout(delay);
  return delay;
}

export async function typeLikePerson(
  page: Page,
  target: Pick<Locator, "pressSequentially">,
  text: string,
) {
  const legacyDelay = Number(process.env.OUTBOUND_TYPING_DELAY_MS || 95);
  const fallbackMinimum = Number.isFinite(legacyDelay)
    ? Math.max(45, legacyDelay)
    : 95;
  const fallbackMaximum = Math.max(fallbackMinimum, Math.round(fallbackMinimum * 1.8));
  const chunks = text.match(/\S+\s*/gu) || [text];
  let wordsUntilPause = randomInteger(3, 7);

  for (const chunk of chunks) {
    const delay = randomDelayFromEnvironment({
      minimumVariable: "BROWSER_TYPING_MIN_DELAY_MS",
      maximumVariable: "BROWSER_TYPING_MAX_DELAY_MS",
      defaultMinimum: fallbackMinimum,
      defaultMaximum: fallbackMaximum,
      absoluteMinimum: 35,
      absoluteMaximum: 350,
    });
    await target.pressSequentially(chunk, { delay });
    wordsUntilPause -= 1;
    if (/[,.!?;:]\s*$/u.test(chunk)) {
      await page.waitForTimeout(randomInteger(240, 850));
      wordsUntilPause = randomInteger(3, 7);
    } else if (wordsUntilPause <= 0) {
      await page.waitForTimeout(randomInteger(140, 480));
      wordsUntilPause = randomInteger(3, 7);
    }
  }
}
