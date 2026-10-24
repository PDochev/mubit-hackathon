import "server-only";
import { chat, type RecordMode } from "./mubit";
import { buildUserMessage, parseVerdict, SYSTEM_PROMPT } from "./prompt";
import type { Claim, Decision, Policy, Precedent } from "./types";

// One model call: the frozen system prompt plus policy, precedents and claim.
export async function verdictFor(
  claim: Claim,
  policy: Policy,
  precedents: Precedent[],
  record: RecordMode,
): Promise<Decision> {
  const user = buildUserMessage(policy.text, precedents, claim);
  const result = await chat(SYSTEM_PROMPT, user, record);
  return {
    ...parseVerdict(result.content),
    mubitRequestId: result.mubitRequestId,
    latencyMs: result.latencyMs,
    precedentIds: precedents.map((p) => p.id),
    policyVersion: policy.version,
    at: new Date().toISOString(),
  };
}

export function limit(concurrency: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    // A finishing task hands its slot straight to the next waiter.
    if (active >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
