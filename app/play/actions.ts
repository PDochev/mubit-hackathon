"use server";

import { askApprentice, currentShift, newShift, ruleClaim, runAudit } from "@/lib/game";
import type { Verdict } from "@/lib/prompt";
import type { ShiftView } from "@/lib/shift";

export async function loadShift() {
  return currentShift();
}

export async function startShift() {
  return newShift();
}

export async function reviewClaim(npcId: string) {
  return askApprentice(npcId);
}

export async function settleClaim(npcId: string, verdict: Verdict, reason?: string) {
  return ruleClaim(npcId, verdict, reason);
}

export async function startAudit(): Promise<{ shift?: ShiftView; error?: string }> {
  try {
    return { shift: await runAudit() };
  } catch (err) {
    console.error("[audit]", err);
    return { error: "The audit couldn't reach the apprentice. Try again." };
  }
}
