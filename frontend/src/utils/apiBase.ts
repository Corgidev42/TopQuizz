/** Base URL API (dev Vite → backend :8000, prod → même origine / nginx). */
export function apiBase(): string {
  if (typeof window === "undefined") return "";
  if (window.location.port === "3000") {
    return `http://${window.location.hostname}:8000`;
  }
  return "";
}

export function apiUrl(path: string): string {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
