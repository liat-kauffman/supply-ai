interface GeminiPayload {
  error?: { message?: string };
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

interface GeminiResult {
  ok: boolean;
  status: number;
  payload: GeminiPayload | null;
  model: string;
  errorMessage?: string;
}

const transientStatuses = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function generateGeminiContent({
  apiKey,
  body,
  timeoutMs = 35_000,
}: {
  apiKey: string;
  body: unknown;
  timeoutMs?: number;
}): Promise<GeminiResult> {
  const models = [
    ...new Set([
      process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
      process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.6-flash",
    ]),
  ];
  let lastResult: GeminiResult = {
    ok: false,
    status: 503,
    payload: null,
    model: models[0] ?? "gemini-3.5-flash-lite",
    errorMessage: "Gemini is temporarily unavailable",
  };

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await wait(1_000 * 2 ** (attempt - 1));
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as GeminiPayload | null;
        lastResult = {
          ok: response.ok,
          status: response.status,
          payload,
          model,
          errorMessage: payload?.error?.message,
        };
        if (response.ok) return lastResult;
        if (!transientStatuses.has(response.status)) break;
      } catch (error) {
        lastResult = {
          ok: false,
          status: 503,
          payload: null,
          model,
          errorMessage:
            error instanceof Error ? error.message : "Gemini request failed",
        };
      }
    }
  }

  return lastResult;
}
