export function discoveryDiagnosticLabel(metadata: string | null) {
  try {
    const value = JSON.parse(metadata || "{}");
    if (typeof value.reason !== "string")
      return "Diagnóstico sem motivo registrado.";
    if (typeof value.instagramUsername === "string")
      return `@${value.instagramUsername} · ${value.stage === "ai" ? "IA" : "Filtro anterior à IA"} · ${value.reason}`;
    if (typeof value.hashtag === "string" && typeof value.postKey === "string")
      return `#${value.hashtag} · post ${value.postKey} · ${value.reason}`;
    return value.reason;
  } catch {
    return "Diagnóstico indisponível.";
  }
}
