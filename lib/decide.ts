import "server-only";
import type { RecordMode } from "./mubit";
import { relevantPrecedents, summariseClaim, tagClaim } from "./precedents";
import type { Verdict } from "./prompt";
import { nextId, readStore, updateStore } from "./store";
import type { Claim, ClaimRecord, Decision, Precedent } from "./types";
import { verdictFor } from "./verdict";

// `ruling` is the reviewer's ruling on this very claim; it always goes in,
// whether or not tag matching would have found it.
async function ask(
  claim: Claim,
  record: RecordMode,
  ruling?: Precedent,
): Promise<Decision> {
  const store = await readStore();
  const matched = relevantPrecedents(claim, store.precedents).filter(
    (p) => p.id !== ruling?.id,
  );
  const precedents = ruling ? [ruling, ...matched].slice(0, 5) : matched;
  return verdictFor(claim, store.policy, precedents, record);
}

function setClaim(id: string, patch: Partial<ClaimRecord>) {
  return updateStore((store) => {
    const claim = store.claims.find((c) => c.id === id);
    if (!claim) throw new Error(`Unknown claim ${id}`);
    Object.assign(claim, patch);
    return claim;
  });
}

async function getClaim(id: string): Promise<ClaimRecord> {
  const claim = (await readStore()).claims.find((c) => c.id === id);
  if (!claim) throw new Error(`Unknown claim ${id}`);
  return claim;
}

export function createClaim(
  draft: Omit<Claim, "id" | "createdAt">,
): Promise<ClaimRecord> {
  return updateStore((store) => {
    const claim: ClaimRecord = {
      ...draft,
      id: nextId("C", store.claims),
      createdAt: new Date().toISOString(),
    };
    store.claims.push(claim);
    return claim;
  });
}

// First pass. Recorded as metadata only, so a reply nobody has checked never
// becomes a training example.
export async function decide(id: string): Promise<ClaimRecord> {
  try {
    const firstPass = await ask(await getClaim(id), "metadata");
    return setClaim(id, { firstPass, error: undefined });
  } catch (err) {
    return setClaim(id, { error: String(err) });
  }
}

// After a human has settled the verdict, re-ask with full recording. Precedents
// now include the reviewer's ruling, so the recorded reply should carry the
// corrected answer. Only a matching reply counts as a verified example.
async function commit(
  id: string,
  verdict: Verdict,
  ruling?: Precedent,
): Promise<ClaimRecord> {
  const claim = await getClaim(id);
  let last: Decision | null = null;
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    try {
      last = await ask(claim, "full", ruling);
      if (last.verdict === verdict) break;
    } catch {
      last = null;
    }
  }
  return setClaim(id, {
    commit: {
      status: last?.verdict === verdict ? "verified" : "unverified",
      verdict: last?.verdict ?? null,
      mubitRequestId: last?.mubitRequestId ?? null,
      attempts,
      at: new Date().toISOString(),
    },
  });
}

export async function approve(id: string): Promise<ClaimRecord> {
  const claim = await getClaim(id);
  if (!claim.firstPass)
    throw new Error(`Claim ${id} has no verdict to approve`);
  await setClaim(id, {
    final: {
      verdict: claim.firstPass.verdict,
      by: "reviewer",
      at: new Date().toISOString(),
    },
  });
  return commit(id, claim.firstPass.verdict);
}

// `save: false` makes a one-off ruling: it corrects this claim's training
// example but isn't reused on later claims.
export async function override(
  id: string,
  verdict: Verdict,
  reason: string,
  { save = true }: { save?: boolean } = {},
): Promise<ClaimRecord> {
  const claim = await getClaim(id);
  const tags = tagClaim(claim);
  const draft = {
    createdAt: new Date().toISOString(),
    claimId: id,
    summary: summariseClaim(claim),
    verdict,
    reason,
    tags,
  };
  if (!save) {
    await setClaim(id, {
      final: { verdict, by: "reviewer", reason, at: draft.createdAt },
    });
    return commit(id, verdict, { id: `R-${id}`, ...draft });
  }
  const precedent = await updateStore((store) => {
    // The same ruling on the same kind of claim is one precedent, not many.
    const same = store.precedents.find(
      (p) =>
        !p.retiredAt &&
        p.verdict === verdict &&
        p.reason === reason &&
        p.tags.join() === tags.join(),
    );
    if (same) return same;
    const p: Precedent = { id: nextId("P", store.precedents), ...draft };
    store.precedents.push(p);
    return p;
  });
  await setClaim(id, {
    final: {
      verdict,
      by: "reviewer",
      reason,
      precedentId: precedent.id,
      at: new Date().toISOString(),
    },
  });
  return commit(id, verdict, precedent);
}
