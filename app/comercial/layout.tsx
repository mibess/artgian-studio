import { getBusinessConfig } from "../../src/config/business";
import { getDashboardData } from "../../src/db/commercial";
import { CommercialSidebar } from "./CommercialSidebar";
import { Pause } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  const [business, data] = await Promise.all([getBusinessConfig(), getDashboardData()]);
  const paused = data.settings.automation_paused === "true";
  return (
    <div className="min-h-screen bg-[#f3f1eb] text-[#193244]">
      <CommercialSidebar companyName={business.company.name} instagramHandle={business.company.instagramHandle} paused={paused} />
      <main className="min-h-screen px-4 pb-12 pt-20 sm:px-7 lg:ml-[264px] lg:px-8 lg:pt-8 xl:px-10">
        {paused && (
          <div className="mx-auto mb-5 flex max-w-[1500px] items-center gap-3 rounded-xl border border-[#e5b44f]/30 bg-[#fff6dc] px-4 py-3 text-xs text-[#75561a]">
            <Pause className="shrink-0" size={16} />
            <strong>Automação geral pausada.</strong><span className="hidden sm:inline">Nenhum envio automático será executado até a retomada manual.</span>
          </div>
        )}
        <div className="mx-auto max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
