export default function CommercialLoading() {
  return (
    <div className="space-y-7" aria-live="polite" aria-busy="true" role="status">
      <span className="sr-only">Carregando painel comercial</span>
      <div className="h-20 animate-pulse rounded-[20px] bg-white/70" />
      <div className="h-44 animate-pulse rounded-[24px] bg-[#193848]/12" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-36 animate-pulse rounded-[20px] bg-white/70" key={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_.9fr]">
        <div className="h-72 animate-pulse rounded-[22px] bg-white/70" />
        <div className="h-72 animate-pulse rounded-[22px] bg-white/70" />
      </div>
    </div>
  );
}
