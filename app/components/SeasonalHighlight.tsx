import Link from "next/link";
import type { SeasonalCampaign } from "../../lib/seasonal-campaign";

type SeasonalHighlightProps = {
  campaign: SeasonalCampaign;
};

export default function SeasonalHighlight({
  campaign,
}: SeasonalHighlightProps) {
  return (
    <section className="mx-auto max-w-[1600px] px-3 pb-3 sm:px-5">
      <div className="relative grid overflow-hidden rounded-[2.2rem] bg-[#132746] text-[#fffaf3] lg:grid-cols-[.88fr_1.12fr]">
        <div className="relative z-10 flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-[6vw] lg:py-24">
          <div className="flex items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#d8bc7b]">
            <span className="size-2 rounded-full bg-[#b57455] shadow-[0_0_0_6px_rgba(181,116,85,.14)]" />
            {campaign.eyebrow}
          </div>
          <h2 className="mt-8 font-serif text-[clamp(3.6rem,6.5vw,6.8rem)] font-normal leading-[0.92] tracking-[-0.055em]">
            {campaign.title}
            <br />
            <i className="font-normal text-[#d9c4a7]">
              {campaign.accentTitle}
            </i>
          </h2>
          <p className="mt-7 max-w-lg text-sm leading-7 text-white/65">
            {campaign.description}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link
              className="inline-flex items-center gap-5 rounded-full bg-[#b57455] py-3 pr-3 pl-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#c27d5c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8bc7b]"
              href={campaign.href}
            >
              {campaign.cta}
              <span className="grid size-9 place-items-center rounded-full bg-[#fffaf3] text-lg text-[#132746]">
                →
              </span>
            </Link>
            <span className="text-xs text-white/50">{campaign.meta}</span>
          </div>
          <div className="mt-7 flex max-w-lg flex-col gap-4 rounded-[1.2rem] border border-white/12 bg-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="block text-[0.6rem] uppercase tracking-[0.17em] text-[#d8bc7b]">
                {campaign.contact.eyebrow}
              </strong>
              <p className="mt-1 text-xs leading-5 text-white/58">
                {campaign.contact.description}
              </p>
            </div>
            <a
              className="shrink-0 text-xs font-semibold text-[#d9c4a7] underline decoration-[#d8bc7b]/55 underline-offset-4 hover:text-white"
              href={campaign.contact.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {campaign.contact.cta} ↗
            </a>
          </div>
        </div>

        <Link
          className="group relative min-h-[32rem] overflow-hidden bg-[#071120] lg:min-h-[42rem]"
          href={campaign.href}
          aria-label={campaign.cta}
        >
          <img
            className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.025]"
            src={campaign.image}
            alt={campaign.imageAlt}
          />
          <span className="absolute right-5 bottom-5 rounded-full border border-white/45 bg-white/65 px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#132746] shadow-lg backdrop-blur-xl sm:right-8 sm:bottom-8">
            {campaign.badge}
          </span>
        </Link>
      </div>
    </section>
  );
}
