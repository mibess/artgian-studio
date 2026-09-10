import { getAuth } from "../../../../lib/auth";

async function handle(request: Request) {
  try {
    return await (await getAuth()).handler(request);
  } catch {
    return Response.json(
      {
        code: "AUTH_UNAVAILABLE",
        message:
          "O acesso à conta está temporariamente indisponível. Tente novamente em instantes.",
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
