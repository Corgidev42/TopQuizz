/** Base URL API (dev Vite → backend :8000, prod → origine absolue pour éviter bugs mobile / base URL). */
export function apiBase(): string {
  if (typeof window === "undefined") return "";
  if (window.location.port === "3000") {
    return `http://${window.location.hostname}:8000`;
  }
  return window.location.origin.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
