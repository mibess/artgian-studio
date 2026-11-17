import PrintingLogo from "./components/PrintingLogo";

export default function Loading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#f7f3ea] px-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div role="status">
        <PrintingLogo className="w-9 sm:w-10" />
        <span className="sr-only">Carregando</span>
      </div>
    </main>
  );
}
