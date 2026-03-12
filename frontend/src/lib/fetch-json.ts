function formatIssuePath(path: unknown): string {
  if (!Array.isArray(path) || path.length === 0) {
    return "";
  }

  return `${path.map((segment) => String(segment)).join(".")}: `;
}

function extractIssueMessage(issues: unknown): string | null {
  if (!Array.isArray(issues)) {
    return null;
  }

  for (const issue of issues) {
    if (!issue || typeof issue !== "object") {
      continue;
    }

    const issueRecord = issue as {
      message?: unknown;
      path?: unknown;
      unionErrors?: Array<{ issues?: unknown }>;
    };

    if (typeof issueRecord.message === "string") {
      return `${formatIssuePath(issueRecord.path)}${issueRecord.message}`;
    }

    if (Array.isArray(issueRecord.unionErrors)) {
      for (const unionError of issueRecord.unionErrors) {
        const nestedMessage = extractIssueMessage(unionError.issues);

        if (nestedMessage) {
          return nestedMessage;
        }
      }
    }
  }

  return null;
}

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
  const data = text ? (JSON.parse(text) as T & { message?: string; issues?: unknown }) : null;

  if (!response.ok) {
    const issueMessage = extractIssueMessage((data as { issues?: unknown } | null)?.issues);
    throw new Error(issueMessage ?? (data as { message?: string } | null)?.message ?? "Request failed.");
  }

  return data as T;
}
