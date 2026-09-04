type Environment = Record<string, string | undefined>;

type RandomDelayOptions = {
  minimumVariable: string;
  maximumVariable: string;
  defaultMinimum: number;
  defaultMaximum: number;
  absoluteMinimum: number;
  absoluteMaximum: number;
  unit?: "milliseconds" | "seconds";
};

function finiteNumber(value: string | undefined, fallback: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function randomInteger(
  minimum: number,
  maximum: number,
  random: () => number = Math.random,
) {
  const low = Math.ceil(Math.min(minimum, maximum));
  const high = Math.floor(Math.max(minimum, maximum));
  const sample = clamp(random(), 0, 0.999999999);
  return low + Math.floor(sample * (high - low + 1));
}

export function randomDelayFromEnvironment(
  options: RandomDelayOptions,
  environment: Environment = process.env,
  random: () => number = Math.random,
) {
  const multiplier = options.unit === "seconds" ? 1_000 : 1;
  const minimum = clamp(
    finiteNumber(environment[options.minimumVariable], options.defaultMinimum),
    options.absoluteMinimum,
    options.absoluteMaximum,
  );
  const maximum = clamp(
    finiteNumber(environment[options.maximumVariable], options.defaultMaximum),
    minimum,
    options.absoluteMaximum,
  );
  return randomInteger(minimum * multiplier, maximum * multiplier, random);
}

export function getAutomaticReplyDelayMs(
  input: { inboundText?: string; outboundText: string },
  environment: Environment = process.env,
  random: () => number = Math.random,
) {
  const minimum = randomDelayFromEnvironment(
    {
      minimumVariable: "AUTO_REPLY_MIN_DELAY_SECONDS",
      maximumVariable: "AUTO_REPLY_MIN_DELAY_SECONDS",
      defaultMinimum: 12,
      defaultMaximum: 12,
      absoluteMinimum: 5,
      absoluteMaximum: 120,
      unit: "seconds",
    },
    environment,
    random,
  );
  const maximum = randomDelayFromEnvironment(
    {
      minimumVariable: "AUTO_REPLY_MAX_DELAY_SECONDS",
      maximumVariable: "AUTO_REPLY_MAX_DELAY_SECONDS",
      defaultMinimum: 35,
      defaultMaximum: 35,
      absoluteMinimum: minimum / 1_000,
      absoluteMaximum: 45,
      unit: "seconds",
    },
    environment,
    random,
  );
  const inboundWords = input.inboundText?.trim().split(/\s+/).filter(Boolean).length || 0;
  const readingTime = 3_500 + inboundWords * 260;
  const composingTime = input.outboundText.trim().length * 55;
  const hesitation = randomInteger(1_500, 5_000, random);
  return clamp(readingTime + composingTime + hesitation, minimum, maximum);
}

export function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
