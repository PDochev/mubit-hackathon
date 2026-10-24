import type { ModelVerdict, Verdict } from "./prompt";

export type Category =
  | "meals"
  | "taxi"
  | "rail"
  | "hotel"
  | "software"
  | "other";

export type ClaimSource = "user" | "seed" | "eval";

export type Claim = {
  id: string;
  createdAt: string;
  source: ClaimSource;
  employee: string;
  category: Category;
  merchant: string;
  amount: number;
  datetime: string;
  headcount: number;
  attendees: string;
  purpose: string;
  receipt: boolean;
  receiptText?: string;
  approvalRef?: string;
  // Generator set of a synthetic claim (see SETS in generate.ts).
  set?: number;
  // Synthetic claims carry the answer the finance team would give.
  expected?: { verdict: Verdict; clause: string; houseRule?: HouseRuleId };
};

export type Decision = ModelVerdict & {
  mubitRequestId: string | null;
  latencyMs: number;
  precedentIds: string[];
  policyVersion: number;
  at: string;
};

export type FinalVerdict = {
  verdict: Verdict;
  by: "auto" | "reviewer";
  reason?: string;
  precedentId?: string;
  at: string;
};

export type Commit = {
  status: "verified" | "unverified";
  verdict: Verdict | null;
  mubitRequestId: string | null;
  attempts: number;
  // Set when the last attempt failed to reach the model at all.
  error?: string;
  at: string;
};

export type ClaimRecord = Claim & {
  firstPass?: Decision;
  // The first pass before the latest policy re-check, if it was re-checked.
  previousPass?: Decision;
  final?: FinalVerdict;
  commit?: Commit;
  error?: string;
};

export type HouseRuleId =
  | "contractor-is-team"
  | "late-client-taxi"
  | "client-coffee";

export type Precedent = {
  id: string;
  createdAt: string;
  claimId: string;
  summary: string;
  verdict: Verdict;
  reason: string;
  tags: string[];
  // How the written policy alone rules on this precedent's claim, as of the
  // last policy check. Agreeing means the policy now covers the ruling.
  policyCheck?: {
    policyVersion: number;
    verdict: Verdict;
    reason: string;
    at: string;
  };
  // Retired precedents stay on record but are no longer sent to the model.
  retiredAt?: string;
};

export type Policy = { text: string; version: number; updatedAt: string };

export type Recheck = {
  policyVersion: number;
  at: string;
  claims: { id: string; before: Verdict; after: Verdict | null }[];
  precedents: { id: string; verdict: Verdict; policyVerdict: Verdict | null }[];
};

export type EvalScore = { n: number; accuracy: number; latencyMs: number };

export type EvalComparison = {
  withPrecedents: EvalScore;
  withoutPrecedents: EvalScore;
};

export type EvalMiss = {
  claim: string;
  expected: Verdict;
  withPrecedents: Verdict | null;
  withoutPrecedents: Verdict | null;
  reason?: string;
};

export type EvalRun = {
  id: string;
  at: string;
  // Generator set: 2 = same templates as the seed, 4 = unseen wording.
  set?: number;
  n: number;
  precedentCount: number;
  policyVersion: number;
  all: EvalComparison;
  houseRule: EvalComparison;
  // Claims answered wrongly with precedents, i.e. what finance still has to rule on.
  misses?: EvalMiss[];
};

export type Store = {
  claims: ClaimRecord[];
  precedents: Precedent[];
  policy: Policy;
  // Earlier policy versions, oldest first.
  policyHistory?: Policy[];
  // What the latest policy version changed for open claims and precedents.
  recheck?: Recheck;
  evals: EvalRun[];
};
