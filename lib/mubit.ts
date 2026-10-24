import "server-only";
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "openai";

export const MUBIT_BASE_URL = "https://api.mubit.ai/openai/v1";
export const MODEL = "gpt-6-luna";

// Thrown instead of a model call when there is no key, so the app can still
// be browsed (from the demo snapshot) without one.
class MissingKeyError extends Error {}

let client: OpenAI | null = null;

function mubit(): OpenAI {
  if (!process.env.MUBIT_API_KEY)
    throw new MissingKeyError("MUBIT_API_KEY is not set");
  client ??= new OpenAI({
    baseURL: MUBIT_BASE_URL,
    apiKey: process.env.MUBIT_API_KEY,
    // Replies take 1-3 s; anything near 15 s is stuck. One retry, so a demo
    // waits at most about half a minute before showing an error.
    maxRetries: 1,
    timeout: 15_000,
  });
  return client;
}

// What went wrong, in words a reviewer can act on. The raw error goes to the
// server log, never to the page.
export function describeError(err: unknown): string {
  if (err instanceof MissingKeyError)
    return "No Mubit API key. Set MUBIT_API_KEY in .env.local and restart the server.";
  if (err instanceof APIConnectionTimeoutError)
    return "Mubit took too long to answer. Try again in a moment.";
  if (err instanceof APIConnectionError)
    return "Couldn't reach Mubit. Check the internet connection and try again.";
  if (err instanceof APIError) {
    if (err.status === 401 || err.status === 403)
      return "Mubit rejected the API key. Check MUBIT_API_KEY.";
    if (err.status === 429)
      return "Mubit is limiting requests right now. Wait a few seconds and try again.";
    if (err.status && err.status >= 500)
      return "Mubit had a problem answering. Try again in a moment.";
    return `Mubit returned an error (${err.status ?? "unknown"}).`;
  }
  if (
    err instanceof SyntaxError ||
    (err instanceof Error && err.name === "ZodError")
  )
    return "The model's reply wasn't in the expected format. Try again.";
  return "Something went wrong checking this claim. Try again.";
}

// "full" records request and reply, so the call can become a kept example.
// "metadata" keeps only timing and tokens, so the call never trains anything.
export type RecordMode = "full" | "metadata";

export type ChatResult = {
  content: string;
  mubitRequestId: string | null;
  latencyMs: number;
};

export async function chat(
  system: string,
  user: string,
  record: RecordMode,
): Promise<ChatResult> {
  const started = Date.now();
  const { data, response } = await mubit()
    .chat.completions.create(
      {
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { headers: { "x-middleware-record": record } },
    )
    .withResponse();

  return {
    content: data.choices[0]?.message.content ?? "",
    mubitRequestId: response.headers.get("x-middleware-request-id"),
    latencyMs: Date.now() - started,
  };
}
