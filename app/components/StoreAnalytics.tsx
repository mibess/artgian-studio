"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useProductCatalog } from "../../lib/products/context";
import {
  GA_MEASUREMENT_ID,
  analyticsPage,
  disableAnalytics,
  readAnalyticsConsent,
  saveAnalyticsConsent,
  subscribeAnalyticsConsent,
  syncAnalyticsPage,
  trackContactClick,
} from "../../lib/analytics";

export default function StoreAnalytics() {
  const pathname = usePathname();
  const catalog = useProductCatalog();
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, readAnalyticsConsent, () => null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const publicPage = Boolean(analyticsPage(pathname, catalog));

  useEffect(() => {
    syncAnalyticsPage(catalog);
    if (consent === "rejected") disableAnalytics();
  }, [catalog, pathname, consent]);

  useEffect(() => {
    if (consent !== "accepted" || !publicPage) return;
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link instanceof HTMLAnchorElement) trackContactClick(link.href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [consent, publicPage]);

  if (!GA_MEASUREMENT_ID || !publicPage) return null;

  function choose(accepted: boolean) {
    saveAnalyticsConsent(accepted ? "accepted" : "rejected");
    setSettingsOpen(false);
    // Unload an already-running third-party library when consent is revoked.
    if (!accepted && consent === "accepted") window.location.reload();
  }

  return (
    <>
      {consent === "accepted" && (
        <Script
          id="artgian-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
      )}
      {consent === null || settingsOpen ? (
        <aside
          aria-label="Preferências de cookies"
          data-cookie-consent-panel=""
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl rounded-2xl border border-[#193244]/15 bg-[#f7f3ea] p-5 text-[#193244] shadow-xl sm:inset-x-auto sm:left-5 sm:mx-0"
        >
          <p className="font-semibold">Sua privacidade importa</p>
          <p className="mt-2 text-sm leading-6">
            Usamos cookies essenciais para o site funcionar. Com sua permissão,
            o Google Analytics mede visitas, interesse nos produtos e cliques de
            contato para melhorarmos a loja. Você pode mudar sua escolha a qualquer momento.
          </p>
          <Link href="/politica-de-privacidade" className="mt-2 inline-block text-xs underline underline-offset-4">
            Política de privacidade
          </Link>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => choose(false)} className="min-h-11 flex-1 rounded-full border border-[#193244] px-4 text-sm font-semibold">
              Apenas essenciais
            </button>
            <button type="button" onClick={() => choose(true)} className="min-h-11 flex-1 rounded-full border border-[#193244] bg-[#193244] px-4 text-sm font-semibold text-white">
              Permitir estatísticas
            </button>
          </div>
          {settingsOpen && <button type="button" onClick={() => setSettingsOpen(false)} className="mt-3 text-xs underline">Fechar preferências</button>}
        </aside>
      ) : (
        <button type="button" onClick={() => setSettingsOpen(true)} className="fixed bottom-3 left-3 z-50 rounded-full border border-[#193244]/20 bg-[#f7f3ea] px-3 py-2 text-xs text-[#193244] shadow-sm">
          Preferências de cookies
        </button>
      )}
    </>
  );
}
