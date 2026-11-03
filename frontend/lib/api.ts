function getOrigin(): string {
  if (typeof window !== "undefined") {
    const env = process.env.NEXT_PUBLIC_API_ORIGIN || "";
    if (env) return env.replace(/\/$/, "");
    return window.location.origin;
  }
  // Server-side rendering never calls the API; there is no page origin to fall back to.
  return process.env.NEXT_PUBLIC_API_ORIGIN || "";
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

/** The message to show for a failed API call: `{"error": "..."}`, `{"detail": "..."}` or field errors. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as Record<string, unknown>;
    const first = data.error ?? data.detail ?? Object.values(data)[0];
    if (Array.isArray(first)) return first.join(" ");
    if (typeof first === "string" && first) return first;
  } catch {
    // not JSON
  }
  return fallback;
}
