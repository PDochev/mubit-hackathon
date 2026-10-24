import "server-only";
import { limit, verdictFor } from "./verdict";
import { generateClaim } from "./generate";
import { relevantPrecedents } from "./precedents";
import { nextId, readStore, updateStore } from "./store";
import type { Claim, EvalRun, EvalScore } from "./types";

// Runs held-out claims (generator set 2, never seeded) twice: with the
// precedents finance has built up, and with none. Recorded as metadata only,
// so evaluation never trains the model.
export async function runEval(n = 36, concurrency = 4): Promise<EvalRun> {
  const { precedents, policy } = await readStore();
  const run = limit(concurrency);
  const now = new Date().toISOString();

  const rows = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      run(async () => {
        const claim: Claim = { ...generateClaim(2, i), id: `E${i + 1}`, createdAt: now, source: "eval" };
        const [withP, withoutP] = await Promise.all([
          verdictFor(claim, policy, relevantPrecedents(claim, precedents), "metadata").catch(() => null),
          verdictFor(claim, policy, [], "metadata").catch(() => null),
        ]);
        return { claim, withP, withoutP };
      }),
    ),
  );

  const score = (subset: typeof rows, pick: "withP" | "withoutP"): EvalScore => {
    const answered = subset.filter((r) => r[pick]);
    const right = answered.filter((r) => r[pick]!.verdict === r.claim.expected!.verdict).length;
    const latency = answered.reduce((sum, r) => sum + r[pick]!.latencyMs, 0);
    return {
      n: subset.length,
      accuracy: subset.length ? right / subset.length : 0,
      latencyMs: answered.length ? Math.round(latency / answered.length) : 0,
    };
  };
  const houseRule = rows.filter((r) => r.claim.expected?.houseRule);

  return updateStore((store) => {
    const result: EvalRun = {
      id: nextId("V", store.evals),
      at: new Date().toISOString(),
      n,
      precedentCount: precedents.length,
      policyVersion: policy.version,
      all: { withPrecedents: score(rows, "withP"), withoutPrecedents: score(rows, "withoutP") },
      houseRule: { withPrecedents: score(houseRule, "withP"), withoutPrecedents: score(houseRule, "withoutP") },
    };
    store.evals.push(result);
    return result;
  });
}
