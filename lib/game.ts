import "server-only";
import { cookies } from "next/headers";
import { encounter, ROUND_1, ROUND_2 } from "./encounters";
import { AUDIT } from "./audit";
import { HOUSE_RULES } from "./generate";
import { describeError } from "./mubit";
import { relevantPrecedents, summariseClaim, tagClaim } from "./precedents";
import { VERDICTS, type Verdict } from "./prompt";
import type { Review, ShiftView, Teaching } from "./shift";
import { nextId, readStore, updateStore } from "./store";
import type { AuditAnswer, Decision, Game, GameClaim, Precedent } from "./types";
import { verdictFor } from "./verdict";

const COOKIE = "night-shift";
// A shift's rulings are numbered R1, R2… so they never read as the inbox's
// precedents (P2, P4…), which cover the same topics with other numbers.
const RULING = "R";
const TEACHINGS: Teaching[] = Object.values(HOUSE_RULES);

function stageOf(game: Game): ShiftView["stage"] {
  const settled = new Set(game.claims.filter((c) => c.final).map((c) => c.npcId));
  if (!ROUND_1.every((e) => settled.has(e.id))) return 1;
  if (!ROUND_2.every((e) => settled.has(e.id))) return 2;
  return 3;
}

function view(game: Game): ShiftView {
  const ruled = game.claims.filter((c) => c.final && c.firstPass);
  const right = (claims: GameClaim[]) =>
    claims.filter((c) => c.firstPass!.verdict === c.final!.verdict).length;
  const roundScore = (round: 1 | 2) => {
    const inRound = ruled.filter((c) => encounter(c.npcId)?.round === round);
    return { ruled: inRound.length, right: right(inRound) };
  };
  return {
    stage: stageOf(game),
    precedents: game.precedents.map((p) => ({
      id: p.id,
      verdict: p.verdict,
      reason: p.reason,
    })),
    settled: game.claims.filter((c) => c.final).map((c) => c.npcId),
    accuracy: ruled.length ? Math.round((100 * right(ruled)) / ruled.length) : 0,
    rounds: { 1: roundScore(1), 2: roundScore(2) },
    commits: game.claims.flatMap((c) =>
      c.commit
        ? [{ npcId: c.npcId, status: c.commit.status, mubitRequestId: c.commit.mubitRequestId }]
        : [],
    ),
    audit: game.audit && {
      results: game.audit.results.map((r) => ({
        ...r,
        title: AUDIT.find((a) => a.id === r.id)?.title ?? r.id,
      })),
      untrainedRight: game.audit.results.filter((r) => r.untrained.verdict === r.expected).length,
      trainedRight: game.audit.results.filter((r) => r.trained.verdict === r.expected).length,
    },
  };
}

function reviewOf(game: Game, npcId: string): Review {
  const row = game.claims.find((c) => c.npcId === npcId);
  return {
    npcId,
    verdict: row?.firstPass?.verdict,
    clause: row?.firstPass?.clause ?? "",
    reason: row?.firstPass?.reason ?? "",
    missing: row?.firstPass?.missing ?? [],
    precedentIds: row?.firstPass?.precedentIds ?? [],
    teachings: TEACHINGS,
    final: row?.final
      ? { verdict: row.final.verdict, precedentId: row.final.precedentId }
      : undefined,
    commit: row?.commit
      ? {
          status: row.commit.status,
          mubitRequestId: row.commit.mubitRequestId,
          error: row.commit.error,
        }
      : undefined,
    error: row?.error,
    shift: view(game),
  };
}

async function cookieId(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

async function remember(id: string) {
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

// A new playthrough: no precedents, so the apprentice has learned nothing yet.
// Returned directly — a cookie set in this request is not visible to a later
// read of the cookie jar.
async function createShift(): Promise<Game> {
  const game: Game = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    precedents: [],
    claims: [],
  };
  await updateStore((store) => {
    store.games ??= [];
    store.games.push(game);
  });
  await remember(game.id);
  return game;
}

export async function newShift(): Promise<ShiftView> {
  return view(await createShift());
}

async function loadShift(): Promise<Game> {
  const id = await cookieId();
  const found = id
    ? (await readStore()).games?.find((g) => g.id === id)
    : undefined;
  return found ?? createShift();
}

function editShift<T>(id: string, mutate: (game: Game) => T): Promise<T> {
  return updateStore((store) => {
    const game = store.games?.find((g) => g.id === id);
    if (!game) throw new Error("This shift has ended. Start a new one.");
    return mutate(game);
  });
}

export async function currentShift(): Promise<ShiftView> {
  return view(await loadShift());
}

// First pass for one coworker. Metadata only: nobody has checked it yet, so
// it must not become a training example. A fresh shift sends no precedents.
export async function askApprentice(npcId: string): Promise<Review> {
  const person = encounter(npcId);
  const game = await loadShift();
  if (!person) return { ...reviewOf(game, npcId), error: "Nobody by that name works here." };
  if (person.round > stageOf(game)) {
    return { ...reviewOf(game, npcId), error: "That claim comes in later tonight." };
  }

  const existing = game.claims.find((c) => c.npcId === npcId);
  if (existing?.firstPass) return reviewOf(game, npcId);

  const claim = existing?.claim ?? {
    ...person.claim,
    id: nextId(
      "G",
      game.claims.map((c) => c.claim),
    ),
    createdAt: new Date().toISOString(),
  };
  if (!existing) {
    await editShift(game.id, (g) => {
      if (!g.claims.some((c) => c.npcId === npcId))
        g.claims.push({ npcId, claim });
    });
  }

  try {
    const store = await readStore();
    const shift = store.games?.find((g) => g.id === game.id);
    if (!shift) throw new Error("This shift has ended. Start a new one.");
    const decision = await verdictFor(
      claim,
      store.policy,
      relevantPrecedents(claim, shift.precedents),
      "metadata",
    );
    const updated = await editShift(game.id, (g) => {
      const row = g.claims.find((c) => c.npcId === npcId);
      if (!row) throw new Error("This shift has ended. Start a new one.");
      row.firstPass = decision;
      row.error = undefined;
      return g;
    });
    return reviewOf(updated, npcId);
  } catch (err) {
    console.error(`[ask ${npcId}]`, err);
    const message = describeError(err);
    const updated = await editShift(game.id, (g) => {
      const row = g.claims.find((c) => c.npcId === npcId);
      if (row) row.error = message;
      return g;
    });
    return reviewOf(updated, npcId);
  }
}

// Re-ask with full recording once the player has settled the verdict, the same
// way the inbox commits a checked claim. Only a reply that matches counts.
async function record(
  gameId: string,
  npcId: string,
  verdict: Verdict,
  ruling?: Precedent,
): Promise<Game> {
  const store = await readStore();
  const shift = store.games?.find((g) => g.id === gameId);
  const row = shift?.claims.find((c) => c.npcId === npcId);
  if (!shift || !row) throw new Error("This shift has ended. Start a new one.");
  const matched = relevantPrecedents(row.claim, shift.precedents).filter(
    (p) => p.id !== ruling?.id,
  );
  const precedents = ruling ? [ruling, ...matched].slice(0, 5) : matched;

  let last: Decision | null = null;
  let error: string | undefined;
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    try {
      last = await verdictFor(row.claim, store.policy, precedents, "full");
      error = undefined;
      if (last.verdict === verdict) break;
    } catch (err) {
      console.error(`[game commit ${npcId}]`, err);
      last = null;
      error = describeError(err);
    }
  }
  return editShift(gameId, (g) => {
    const claim = g.claims.find((c) => c.npcId === npcId);
    if (!claim) throw new Error("This shift has ended. Start a new one.");
    claim.commit = {
      status: last?.verdict === verdict ? "verified" : "unverified",
      verdict: last?.verdict ?? null,
      mubitRequestId: last?.mubitRequestId ?? null,
      attempts,
      error,
      at: new Date().toISOString(),
    };
    return g;
  });
}

// Agreeing confirms the apprentice's call. Disagreeing saves the sentence as
// a precedent for the rest of this shift, then records it through Mubit.
export async function ruleClaim(
  npcId: string,
  verdict: Verdict,
  reason?: string,
): Promise<Review> {
  if (!VERDICTS.includes(verdict)) {
    const game = await loadShift();
    return { ...reviewOf(game, npcId), error: "That isn't a verdict." };
  }
  const game = await loadShift();
  const row = game.claims.find((c) => c.npcId === npcId);
  if (!row?.firstPass) {
    return { ...reviewOf(game, npcId), error: "The apprentice hasn't reviewed this yet." };
  }
  if (row.final) return reviewOf(game, npcId);

  const agrees = verdict === row.firstPass.verdict;
  const text = (reason ?? "").trim().slice(0, 300);
  if (!agrees && !text) {
    return { ...reviewOf(game, npcId), error: "Say why, in one sentence." };
  }

  let ruling: Precedent | undefined;
  if (!agrees) {
    ruling = await editShift(game.id, (g) => {
      const tags = tagClaim(row.claim);
      const same = g.precedents.find(
        (p) =>
          !p.retiredAt &&
          p.verdict === verdict &&
          p.reason === text &&
          p.tags.join() === tags.join(),
      );
      if (same) return same;
      const precedent: Precedent = {
        id: nextId(RULING, g.precedents),
        createdAt: new Date().toISOString(),
        claimId: row.claim.id,
        summary: summariseClaim(row.claim),
        verdict,
        reason: text,
        tags,
      };
      g.precedents.push(precedent);
      return precedent;
    });
  }

  await editShift(game.id, (g) => {
    const claim = g.claims.find((c) => c.npcId === npcId);
    if (!claim) throw new Error("This shift has ended. Start a new one.");
    claim.final = {
      verdict,
      reason: ruling?.reason,
      precedentId: ruling?.id,
      at: new Date().toISOString(),
    };
  });
  const updated = await record(game.id, npcId, verdict, ruling);
  return reviewOf(updated, npcId);
}

async function auditAnswer(
  claim: Parameters<typeof verdictFor>[0],
  policy: Parameters<typeof verdictFor>[1],
  precedents: Precedent[],
): Promise<AuditAnswer> {
  try {
    const d = await verdictFor(claim, policy, precedents, "metadata");
    return {
      verdict: d.verdict,
      clause: d.clause,
      precedentIds: d.precedentIds,
      mubitRequestId: d.mubitRequestId,
    };
  } catch (err) {
    console.error(`[audit ${claim.id}]`, err);
    return {
      verdict: null,
      clause: "",
      precedentIds: [],
      mubitRequestId: null,
      error: describeError(err),
    };
  }
}

// The 09:00 audit, once both rounds are ruled: every unseen claim asked as
// the apprentice started the night (no precedents) and as it ends it (this
// shift's precedents). Metadata only: these answers are unchecked, so none
// of them become training examples. Runs once per shift.
export async function runAudit(): Promise<ShiftView> {
  const game = await loadShift();
  if (game.audit) return view(game);
  if (stageOf(game) < 3) throw new Error("The audit starts at 09:00. Finish tonight's claims first.");

  const { policy } = await readStore();
  const results = await Promise.all(
    AUDIT.map(async (a) => {
      const claim = { ...a.claim, id: `A-${a.id}`, createdAt: new Date().toISOString() };
      const [untrained, trained] = await Promise.all([
        auditAnswer(claim, policy, []),
        auditAnswer(claim, policy, relevantPrecedents(claim, game.precedents)),
      ]);
      return { id: a.id, expected: a.expected, untrained, trained };
    }),
  );
  const updated = await editShift(game.id, (g) => {
    g.audit ??= { at: new Date().toISOString(), results };
    return g;
  });
  return view(updated);
}
