import Link from "next/link";
import type { jobs, localBusinessOpportunities } from "../../../db/schema";
import { parseInstagramImportPayload } from "../../../src/features/outbound/instagram-import-domain";
import { SubmitButton } from "../../components/PendingButton";
import { importLocalBusinessInstagram } from "../actions";
import { ImportRefresh } from "./ImportRefresh";

type Job = typeof jobs.$inferSelect;

function importMessage(job: Job) {
  if (job.status === "running")
    return "Lendo o perfil no Chrome e validando os critérios da campanha…";
  if (job.status === "pending")
    return (
      job.lastError ||
      "Aguardando o Chrome local. Esta etapa não envia mensagens."
    );
  if (job.status === "dead_letter")
    return (
      job.lastError || "Falha na importação. Confira o @ e tente novamente."
    );
  try {
    const result = JSON.parse(job.payload).result;
    if (typeof result?.reason === "string") return result.reason;
  } catch {
    /* Payloads antigos podem não ter resultado. */
  }
  return "Importação finalizada.";
}

export function ImportInstagramForm({
  opportunity,
  job,
}: {
  opportunity: typeof localBusinessOpportunities.$inferSelect;
  job?: Job;
}) {
  const busy = Boolean(job && ["pending", "running"].includes(job.status));
  return (
    <div className="mt-5 border-t border-[#edf0ec] pt-4">
      {job && (
        <p role="status" className="mb-3 text-xs leading-5 text-[#657780]">
          {importMessage(job)}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-[#2f7c60]">
          Importar Instagram
        </summary>
        <p className="mt-2 text-xs leading-5 text-[#73858c]">
          Encontrou o perfil desta empresa? Informe o @. O Chrome lê o perfil e
          a IA rápida valida a aderência à campanha antes de adicioná-lo ao
          Público.
        </p>
        <form action={importLocalBusinessInstagram} className="mt-3 space-y-3">
          <input
            type="hidden"
            name="campaignId"
            value={opportunity.campaignId}
          />
          <input type="hidden" name="opportunityId" value={opportunity.id} />
          <label className="block text-xs font-semibold text-[#526b78]">
            Instagram da empresa
            <input
              name="instagramUsername"
              required
              maxLength={160}
              placeholder="@nataliaacesar"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={
                job
                  ? parseInstagramImportPayload(job.payload)?.instagramUsername
                  : ""
              }
              disabled={busy}
              className="mt-2 h-10 w-full rounded-xl border border-[#dfe2de] bg-white px-3 text-sm outline-none focus:border-[#6ba68d] focus:ring-2 focus:ring-[#d8ede4] disabled:opacity-50"
            />
          </label>
          <SubmitButton
            disabled={busy}
            pendingLabel="Agendando validação…"
            className="rounded-xl bg-[#193848] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "Importação em andamento" : "Validar e importar"}
          </SubmitButton>
          <p className="text-xs leading-5 text-[#73858c]">
            Não gera rascunho nem envia mensagem. Se reprovado, o motivo aparece
            aqui e você pode corrigir o @.
          </p>
        </form>
      </details>
    </div>
  );
}

export function InstagramImportHistory({
  campaignId,
  imports,
}: {
  campaignId: string;
  imports: Job[];
}) {
  if (!imports.length) return null;
  return (
    <section
      aria-label="Importações de Instagram"
      className="mb-5 rounded-2xl border border-[#dbe1dc] bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold">Importações de Instagram</h4>
        <ImportRefresh
          active={imports.some((job) =>
            ["pending", "running"].includes(job.status),
          )}
        />
      </div>
      <ul className="mt-4 space-y-3">
        {imports.slice(0, 5).map((job) => (
          <li key={job.id} className="text-xs leading-5 text-[#657780]">
            <strong className="text-[#294653]">
              @{parseInstagramImportPayload(job.payload)?.instagramUsername}
            </strong>{" "}
            · {importMessage(job)}
          </li>
        ))}
      </ul>
      <Link
        href={`/comercial/campanhas?id=${encodeURIComponent(campaignId)}&aba=publico`}
        className="mt-4 inline-block text-xs font-semibold text-[#2f7c60]"
      >
        Ver perfis no Público →
      </Link>
    </section>
  );
}
