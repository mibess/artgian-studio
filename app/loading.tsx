export default function Loading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#f7f3ea] px-6 text-[#173244]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4" role="status">
        <span className="ui-spinner ui-spinner-large" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#647087]">
          Carregando
        </p>
      </div>
    </main>
  );
}
