import { PaginationLink } from "./PaginationLink";
import { paginationHref, type Pagination as PaginationData, type PaginationParams } from "../../../src/features/leads/pagination";

export function Pagination({ data, pathname, params, pageKey = "pagina", label, compact = false }: {
  data: PaginationData;
  pathname: string;
  params: PaginationParams;
  pageKey?: string;
  label: string;
  compact?: boolean;
}) {
  const { total, page, pageCount, pageSize, offset } = data;
  const buttonClass = "rounded-lg border border-[#dfe2de] bg-white px-3 py-2 text-[11px] font-semibold text-[#425966] transition hover:border-[#e07a5f] hover:text-[#d96245] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e07a5f]";
  return <nav aria-label={`Paginação de ${label}`} className={`flex flex-wrap items-center gap-3 border-t border-[#e1e1db] text-[10px] text-[#657780] ${compact ? "mt-3 justify-center pt-3" : "justify-between p-4"}`}>
    <p className={compact ? "w-full text-center" : ""}>{total ? `${offset + 1}–${Math.min(offset + pageSize, total)} de ${total}` : "0 registros"}</p>
    {pageCount > 1 && <div className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? <PaginationLink scroll={!compact} href={paginationHref(pathname, params, pageKey, page - 1)} className={buttonClass}>Anterior</PaginationLink> : <span aria-disabled="true" className={`${buttonClass} opacity-40`}>Anterior</span>}
      <span aria-current="page">{page} / {pageCount}</span>
      {page < pageCount ? <PaginationLink scroll={!compact} href={paginationHref(pathname, params, pageKey, page + 1)} className={buttonClass}>Próxima</PaginationLink> : <span aria-disabled="true" className={`${buttonClass} opacity-40`}>Próxima</span>}
    </div>}
  </nav>;
}
