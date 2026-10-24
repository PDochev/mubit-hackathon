import type { Verdict } from "./prompt";

// What the office scene is allowed to know. The claim text and the right
// answer stay on the server.
export type Teaching = { verdict: Verdict; reason: string };

export type ShiftView = {
  precedents: { id: string; verdict: Verdict; reason: string }[];
  // Coworkers whose claim this apprentice has already been ruled on.
  settled: string[];
  // Share of ruled claims the apprentice got right before being corrected.
  accuracy: number;
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
