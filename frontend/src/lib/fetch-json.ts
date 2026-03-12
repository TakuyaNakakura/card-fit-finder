export async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { message?: string }) : null;

  if (!response.ok) {
    throw new Error((data as { message?: string } | null)?.message ?? "Request failed.");
  }

  return data as T;
}
