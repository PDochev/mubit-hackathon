import { z } from "zod";
import type { Claim, Precedent } from "./types";

// FROZEN. Mubit groups calls into one task by model, instructions and output
// format. Editing this text (or the user-message layout below) starts a new
// task from zero kept examples. Put anything that varies in the user message.
export const SYSTEM_PROMPT = `Review expense claims against the company expense policy and the finance team's precedents.

Precedents are rulings the finance team made on similar past claims. When a precedent applies, follow it over your own reading of the policy.

Choose exactly one verdict:
- "approve": the claim complies with the policy.
- "violation": the claim breaks a policy rule.
- "needs_info": you cannot decide without missing information, such as a receipt, attendee details or an approval reference.

Reply with JSON only, in this shape:
{"verdict": "approve" | "violation" | "needs_info", "clause": "the policy section (e.g. §3) or precedent id (e.g. P2) you relied on", "reason": "one short sentence", "missing": ["what is missing, if needs_info"], "confidence": 0.0-1.0}`;

export const VERDICTS = ["approve", "violation", "needs_info"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const verdictSchema = z.object({
  verdict: z.enum(VERDICTS),
  clause: z.string().default(""),
  reason: z.string().default(""),
  missing: z.array(z.string()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export type ModelVerdict = z.infer<typeof verdictSchema>;

export function parseVerdict(content: string): ModelVerdict {
  return verdictSchema.parse(JSON.parse(content));
}

const money = (n: number) => `£${n.toFixed(2)}`;

export function formatClaim(claim: Claim): string {
  const lines = [
    `Employee: ${claim.employee}`,
    `Category: ${claim.category}`,
    `Merchant: ${claim.merchant}`,
    `Amount: ${money(claim.amount)}`,
    `Date and time: ${claim.datetime}`,
    `Submitted: ${claim.createdAt.slice(0, 10)}`,
    `Headcount: ${claim.headcount}`,
    `Attendees: ${claim.attendees || "not given"}`,
    `Purpose: ${claim.purpose}`,
    `Receipt: ${claim.receipt ? "attached" : "missing"}`,
  ];
  if (claim.receiptText) lines.push(`Receipt text: ${claim.receiptText}`);
  if (claim.approvalRef) lines.push(`Approval reference: ${claim.approvalRef}`);
  return lines.join("\n");
}

export function formatPrecedent(p: Precedent): string {
  return `- [${p.id}] ${p.summary} → ${p.verdict}. Ruling: ${p.reason}`;
}

export function buildUserMessage(
  policy: string,
  precedents: Precedent[],
  claim: Claim,
): string {
  const rulings = precedents.length
    ? precedents.map(formatPrecedent).join("\n")
    : "(none)";
  return `## Company expense policy
${policy.trim()}

## Finance team precedents
${rulings}

## Claim
${formatClaim(claim)}`;
}
