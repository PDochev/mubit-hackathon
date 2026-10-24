import type { Verdict } from "./prompt";
import type { AuditAnswer } from "./types";

// What the office scene is allowed to know. The claim text and the right
// answer stay on the server, until the audit is over.
export type Teaching = { verdict: Verdict; reason: string };

// How often the apprentice's own call matched yours, in one round.
export type RoundScore = { ruled: number; right: number };

export type AuditView = {
  results: {
    id: string;
    title: string;
    expected: Verdict;
    untrained: AuditAnswer;
    trained: AuditAnswer;
  }[];
  untrainedRight: number;
  trainedRight: number;
};

export type ShiftView = {
  // 1 and 2 are the night's rounds of claims; 3 is the 09:00 audit.
  stage: 1 | 2 | 3;
  precedents: { id: string; verdict: Verdict; reason: string }[];
  // Claims this apprentice has already been ruled on.
  settled: string[];
  // Share of ruled claims the apprentice got right before being corrected.
  accuracy: number;
  rounds: { 1: RoundScore; 2: RoundScore };
  // Every ruling recorded through Mubit tonight.
  commits: {
    npcId: string;
    status: "verified" | "unverified";
    mubitRequestId: string | null;
  }[];
  audit?: AuditView;
};

export type Review = {
  npcId: string;
  verdict?: Verdict;
  clause: string;
  reason: string;
  // What the apprentice would ask the employee for, when it needs more info.
  missing: string[];
  precedentIds: string[];
  teachings: Teaching[];
  final?: { verdict: Verdict; precedentId?: string };
  commit?: {
    status: "verified" | "unverified";
    mubitRequestId: string | null;
    error?: string;
  };
  error?: string;
  shift: ShiftView;
};
