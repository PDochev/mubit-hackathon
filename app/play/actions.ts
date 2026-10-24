"use server";

import { askApprentice, currentShift, newShift, ruleClaim } from "@/lib/game";
import type { Verdict } from "@/lib/prompt";

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
