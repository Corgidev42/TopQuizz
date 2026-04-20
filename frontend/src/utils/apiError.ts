/**
 * Normalise le champ `detail` des réponses FastAPI (string, liste 422, etc.).
 */
export function formatApiDetail(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.msg === "string") return o.msg;
        if (typeof o.message === "string") return o.message;
      }
      return "";
    });
    return parts.filter(Boolean).join(" · ");
  }
  if (typeof detail === "object" && detail !== null) {
    const o = detail as Record<string, unknown>;
    if (typeof o.msg === "string") return o.msg;
    if (typeof o.message === "string") return o.message;
  }
  return "";
}

/**
 * À partir du corps brut (déjà lu) et du status, message utilisateur.
 */
export function errorMessageFromBody(
  res: Response,
  rawText: string,
  fallback: string,
): string {
  const trimmed = rawText.trim();
  if (trimmed) {
    try {
      const data = JSON.parse(trimmed) as { detail?: unknown };
      const fromDetail = formatApiDetail(data.detail);
      if (fromDetail) return fromDetail;
    } catch {
      /* pas du JSON */
    }
    if (trimmed.length < 280 && !/<html/i.test(trimmed)) return trimmed;
  }
  if (res.status === 404) {
    return "API introuvable (404). Recharge la page ou vérifie que le serveur est à jour.";
  }
  if (res.status === 422) {
    return "Données invalides (email, mot de passe 6+ car., pseudo 2+ car.).";
  }
  if (res.status >= 500) {
    return `Erreur serveur (${res.status}). Vérifie que le backend et Redis sont démarrés.`;
  }
  if (res.status === 0) {
    return "Connexion bloquée (réseau ou certificat). Accepte le certificat HTTPS puis réessaie.";
  }
  return fallback;
}
