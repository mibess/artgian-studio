import PrintingLogo from "./components/PrintingLogo";

export default function Loading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#f7f3ea] px-6 text-[#0b2447]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5" role="status">
        <PrintingLogo className="w-40 sm:w-48" variant="page" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#647087]">
          Carregando
        </p>
      </div>
    </main>
  );
}
