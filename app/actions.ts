"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { approve, createClaim, decide, override } from "@/lib/decide";
import { runEval } from "@/lib/eval";
import { VERDICTS, type Verdict } from "@/lib/prompt";
import { assertReviewer } from "@/lib/reviewer";
import { updateStore } from "@/lib/store";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = ["meals", "taxi", "rail", "hotel", "software", "other"];
const AUTO_APPROVE_CONFIDENCE = 0.85;
const AUTO_APPROVE_MAX_AMOUNT = 100;
const MAX_FIELD_LENGTH = 300;

// Form text is untrusted and goes into the model prompt, so keep it short.
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim().slice(0, MAX_FIELD_LENGTH);

export async function submitClaim(form: FormData) {
  const category = text(form, "category") as Category;
  const claim = await createClaim({
    source: "user",
    employee: text(form, "employee") || "Anonymous",
    category: CATEGORIES.includes(category) ? category : "other",
    merchant: text(form, "merchant"),
    amount: Number(text(form, "amount")) || 0,
    datetime: text(form, "datetime"),
    headcount: Math.max(1, Number(text(form, "headcount")) || 1),
    attendees: text(form, "attendees"),
    purpose: text(form, "purpose"),
    receipt: form.get("receipt") === "yes",
    receiptText: text(form, "receiptText") || undefined,
    approvalRef: text(form, "approvalRef") || undefined,
  });

  const decided = await decide(claim.id);
  const first = decided.firstPass;
  // Confident approvals of small, receipted claims go straight through. The
  // model's say-so alone is never enough (claim text could try to talk it
  // into approving), so the amount and receipt checks are deterministic.
  // Auto-approved claims are never committed, so only human-checked answers train.
  const lowRisk = claim.amount <= AUTO_APPROVE_MAX_AMOUNT && (claim.receipt || claim.amount <= 25);
  if (lowRisk && first?.verdict === "approve" && first.confidence >= AUTO_APPROVE_CONFIDENCE) {
    await updateStore((store) => {
      const c = store.claims.find((x) => x.id === claim.id);
      if (c) c.final = { verdict: "approve", by: "auto", at: new Date().toISOString() };
    });
  }
  redirect(`/submit/${claim.id}`);
}

export async function approveClaim(id: string) {
  await assertReviewer();
  await approve(id);
  refresh();
}

export async function overrideClaim(form: FormData) {
  await assertReviewer();
  const verdict = text(form, "verdict") as Verdict;
  const reason = text(form, "reason");
  if (!VERDICTS.includes(verdict) || !reason) return;
  await override(text(form, "id"), verdict, reason);
  refresh();
}

export async function updatePolicy(form: FormData) {
  await assertReviewer();
  const policy = text(form, "policy");
  if (!policy) return;
  await updateStore((store) => {
    if (store.policy.text === policy) return;
    store.policy = { text: policy, version: store.policy.version + 1, updatedAt: new Date().toISOString() };
  });
  refresh();
}

export async function deletePrecedent(id: string) {
  await assertReviewer();
  await updateStore((store) => {
    store.precedents = store.precedents.filter((p) => p.id !== id);
  });
  refresh();
}

export async function runEvaluation() {
  await assertReviewer();
  await runEval();
  refresh();
}
