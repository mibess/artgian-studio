import { z } from "zod";
import { getCustomerSession } from "../../../../../lib/auth";
import { getPaymentState, PaymentError, paymentSubmissionSchema, retryUncertainPayment, submitPayment } from "../../../../../lib/embedded-payments";
import { requestOrigin } from "../../../../../lib/request-origin";

type Context = { params: Promise<{ id: string }> };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
function failure(error: unknown) {
  if (error instanceof PaymentError) return response({ error: error.message }, error.status);
  if (error instanceof SyntaxError || error instanceof z.ZodError) return response({ error: "Confira os dados do pagamento e tente novamente." }, 400);
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
