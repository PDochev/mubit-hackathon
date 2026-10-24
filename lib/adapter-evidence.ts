import type { Verdict } from "./prompt";

// Mubit's API doesn't expose adapter results, so these are copied by hand
// from the console's Adapters page and one silent-test pair in Requests.
// Update them when a new version trains.

export type PairReply = {
  model: string;
  verdict: Verdict;
  clause: string;
  reason: string;
  latencyMs: number;
  tokensOut: number;
};

export const ADAPTER_EVIDENCE = {
  copiedAt: "24 Oct, 10:22",
  consoleUrl:
    "https://app.mubit.ai/console/projects/ws-e4d85b3d9c35a2e0/adapters?adapter=ad_lane_038749d7",
  version: "v1",
  base: "Qwen3-4B-Instruct-2507",
  // When v1's training started (console: 23 Oct, 20:35:31 London time).
  trainingStartedAt: "2026-10-23T19:35:31Z",
  // The engine's exam on held-out examples: the untrained base vs the adapter.
  exam: { base: 0, adapter: 0.692, cases: 13 },
  // Silent-test pairs, each judged by gemini-3.8-flash against the provider's reply.
  live: { passed: 15, graded: 21 },
  // One silent-test pair: a claim covered by precedent P2 (contractors count as team).
  pair: {
    claimId: "C253",
    provider: {
      model: "gpt-6-luna",
      verdict: "violation",
      clause: "P2",
      reason:
        "The freelance photographer counts as team, so the £30-per-head team meal cap applies and the £349.91 total exceeds the £180 cap for six people.",
      latencyMs: 2430,
      tokensOut: 150,
    } satisfies PairReply,
    adapter: {
      model: "Qwen3-4B adapter v1",
      verdict: "violation",
      clause: "P2",
      reason: "The freelancer counts as team, so the £30-per-head cap applies.",
      latencyMs: 579,
      tokensOut: 41,
    } satisfies PairReply,
  },
};
