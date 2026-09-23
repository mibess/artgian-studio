import { z } from "zod";
import { getCustomerSession } from "../../../../../lib/auth";
import { getPaymentState, PaymentError, paymentSubmissionSchema, retryUncertainPayment, submitPayment } from "../../../../../lib/embedded-payments";
import { requestOrigin } from "../../../../../lib/request-origin";

type Context = { params: Promise<{ id: string }> };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const validationMessages: Record<string, string> = {
  deviceId: "Não foi possível validar a sessão de pagamento. Recarregue a página e tente novamente.",
  "card.identificationNumber": "Confira o CPF do titular do cartão e tente novamente.",
  "card.installments": "Selecione uma opção de parcelamento válida.",
  "card.issuerId": "Selecione o banco emissor do cartão.",
};
const diagnosticFields = new Set(["requestId", "retryAttemptId", "method", "deviceId", "card", "card.token", "card.paymentMethodId", "card.issuerId", "card.installments", "card.identificationNumber"]);
function failure(error: unknown) {
  if (error instanceof PaymentError) return response({ error: error.message }, error.status);
  if (error instanceof z.ZodError) {
    // Log only known field names and validation codes, never submitted values,
    // tokens, provider identifiers, documents or unrecognized payload keys.
    const issues = error.issues.map(issue => {
      const field = issue.path.join(".");
      return { field: diagnosticFields.has(field) ? field : "payload", code: issue.code };
    });
    console.warn("[payment] invalid submission", { issues });
    return response({ error: issues.map(issue => validationMessages[issue.field]).find(Boolean) ?? "Confira os dados do pagamento e tente novamente." }, 400);
  }
  if (error instanceof SyntaxError) return response({ error: "Confira os dados do pagamento e tente novamente." }, 400);
  return response({ error: "Não foi possível consultar o pagamento. Tente novamente em instantes." }, 503);
}

export async function GET(request: Request, context: Context) {
  const session = await getCustomerSession(request.headers);
  if (!session) return response({ error: "Entre na sua conta para acompanhar o pedido." }, 401);
  try { return response(await getPaymentState((await context.params).id, session.user.id, true)); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request)) return response({ error: "Origem inválida." }, 403);
  const session = await getCustomerSession(request.headers);
  if (!session) return response({ error: "Entre na sua conta para pagar." }, 401);
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (body && typeof body === "object" && "retryAttemptId" in body) {
      const retry = z.object({ retryAttemptId: z.uuid() }).strict().parse(body);
      return response(await retryUncertainPayment(id, session.user.id, retry.retryAttemptId));
    }
    return response(await submitPayment(id, session.user.id, paymentSubmissionSchema.parse(body)));
  } catch (error) { return failure(error); }
}
