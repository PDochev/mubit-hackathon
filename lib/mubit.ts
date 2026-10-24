import "server-only";
import OpenAI from "openai";

export const MUBIT_BASE_URL = "https://api.mubit.ai/openai/v1";
export const MODEL = "gpt-6-luna";

const client = new OpenAI({
  baseURL: MUBIT_BASE_URL,
  apiKey: process.env.MUBIT_API_KEY,
  maxRetries: 1,
  timeout: 60_000,
});

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
  const { data, response } = await client.chat.completions
    .create(
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
