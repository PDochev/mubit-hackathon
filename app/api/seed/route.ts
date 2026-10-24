import { assertReviewer } from "@/lib/reviewer";
import { approve, createClaim, decide, override } from "@/lib/decide";
import { generateClaim, HOUSE_RULES } from "@/lib/generate";
import { readStore } from "@/lib/store";
import { limit } from "@/lib/verdict";

// Plays the finance reviewer over synthetic claims: approves correct first-pass
// verdicts and overrides wrong ones (with the house rule as the reason). Each
// claim ends in one fully recorded call, i.e. one Mubit training example.
export async function POST(request: Request) {
  await assertReviewer();
  const body = (await request.json().catch(() => ({}))) as { n?: number; concurrency?: number };
  const n = Math.min(body.n ?? 10, 100);
  const run = limit(body.concurrency ?? 3);
  const offset = (await readStore()).claims.filter((c) => c.source === "seed").length;

  const results = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      run(async () => {
        const claim = await createClaim({ ...generateClaim(1, offset + i), source: "seed" });
        const decided = await decide(claim.id);
        const expected = claim.expected!;
        if (!decided.firstPass) return { id: claim.id, outcome: "error", error: decided.error };

        const correct = decided.firstPass.verdict === expected.verdict;
        const final = correct
          ? await approve(claim.id)
          : await override(
              claim.id,
              expected.verdict,
              expected.houseRule
                ? HOUSE_RULES[expected.houseRule].reason
                : `Finance ruling: this is ${expected.verdict} under ${expected.clause}.`,
              // Only house rules are worth reusing; a plain model slip is a one-off.
              { save: Boolean(expected.houseRule) },
            );
        return {
          id: claim.id,
          outcome: correct ? "approved" : "overridden",
          firstPass: decided.firstPass.verdict,
          expected: expected.verdict,
          houseRule: expected.houseRule,
          commit: final.commit?.status,
        };
      }),
    ),
  );

  const count = (key: string, value: unknown) =>
    results.filter((r) => (r as Record<string, unknown>)[key] === value).length;
  return Response.json({
    n,
    offset,
    approved: count("outcome", "approved"),
    overridden: count("outcome", "overridden"),
    errors: count("outcome", "error"),
    verified: count("commit", "verified"),
    unverified: count("commit", "unverified"),
    results,
  });
}
