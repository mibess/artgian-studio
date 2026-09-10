/** Next's internal URL may use localhost after Proxy; Host retains the public host. */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url.origin;
}
