function getOrigin(): string {
  if (typeof window !== "undefined") {
    const env = process.env.NEXT_PUBLIC_API_ORIGIN || "";
    if (env) return env.replace(/\/$/, "");
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:8000";
}

export function getApiBase(): string {
  return getOrigin().replace(/\/$/, "");
}

export function getWsOrigin(): string {
  const origin = getOrigin();
  if (!origin) return "ws";
  if (origin.startsWith("https")) return origin.replace("https", "wss");
  return origin.replace("http", "ws");
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, ...init } = options;
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers });
}
