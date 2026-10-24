import "server-only";
import { relevantPrecedents } from "./precedents";
import { readStore, updateStore } from "./store";
import type { Recheck } from "./types";
import { limit, verdictFor } from "./verdict";

// Saves a new policy version, keeping the old one in the history.
// Returns false when the text is unchanged.
export function savePolicy(text: string): Promise<boolean> {
  return updateStore((store) => {
    if (store.policy.text === text) return false;
    store.policyHistory = [...(store.policyHistory ?? []), store.policy];
    store.policy = {
      text,
      version: store.policy.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return true;
  });
}

// Fast refresh: after a policy edit, re-ask the model about every open claim
// under the new policy, and check each active precedent's claim against the
// policy alone. A precedent the policy now agrees with is covered by it and
// can be retired. All calls are metadata only, so nothing here trains.
export async function recheckPolicy(concurrency = 4): Promise<Recheck> {
  const { claims, precedents, policy } = await readStore();
  const run = limit(concurrency);
  const open = claims.filter((c) => c.firstPass && !c.final);
  const active = precedents.filter((p) => !p.retiredAt);

  const [claimResults, precedentResults] = await Promise.all([
    Promise.all(
      open.map((c) =>
        run(async () => ({
          claim: c,
          after: await verdictFor(
            c,
            policy,
            relevantPrecedents(c, precedents),
            "metadata",
          ).catch(() => null),
        })),
      ),
    ),
    Promise.all(
      active.map((p) =>
        run(async () => {
          const claim = claims.find((c) => c.id === p.claimId);
          return {
            precedent: p,
            check: claim
              ? await verdictFor(claim, policy, [], "metadata").catch(
                  () => null,
                )
              : null,
          };
        }),
      ),
    ),
  ]);

  return updateStore((store) => {
    const at = new Date().toISOString();
    for (const { claim, after } of claimResults) {
      const c = store.claims.find((x) => x.id === claim.id);
      // Skip claims a reviewer decided while the re-check was running.
      if (!c || c.final || !after) continue;
      // Keep the answer from the older policy version across repeat re-checks.
      if (c.firstPass?.policyVersion !== after.policyVersion)
        c.previousPass = c.firstPass;
      c.firstPass = after;
    }
    for (const { precedent, check } of precedentResults) {
      const p = store.precedents.find((x) => x.id === precedent.id);
      if (p && check)
        p.policyCheck = {
          policyVersion: policy.version,
          verdict: check.verdict,
          reason: check.reason,
          at,
        };
    }
    store.recheck = {
      policyVersion: policy.version,
      at,
      claims: claimResults.map(({ claim, after }) => ({
        id: claim.id,
        before: claim.firstPass!.verdict,
        after: after?.verdict ?? null,
      })),
      precedents: precedentResults.map(({ precedent, check }) => ({
        id: precedent.id,
        verdict: precedent.verdict,
        policyVerdict: check?.verdict ?? null,
      })),
    };
    return store.recheck;
  });
}

export function setRetired(id: string, retired: boolean) {
  return updateStore((store) => {
    const p = store.precedents.find((x) => x.id === id);
    if (p) p.retiredAt = retired ? new Date().toISOString() : undefined;
  });
}
