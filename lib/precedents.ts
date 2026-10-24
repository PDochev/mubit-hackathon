import type { Claim, Precedent } from "./types";

const KEYWORDS: [RegExp, string][] = [
  [/contractor|freelanc|interim|agency/i, "contractor"],
  [/client|customer|prospect/i, "client"],
  [/coffee|caf[eé]|pret|starbucks|costa|flat white|espresso|latte|cappuccino/i, "coffee"],
  [/alcohol|wine|beer|peroni|prosecco|cocktail/i, "alcohol"],
  [/airport|heathrow|gatwick|luggage/i, "airport"],
  [/equipment|kit|monitor/i, "equipment"],
  [/first class/i, "first-class"],
];

export function tagClaim(claim: Claim): string[] {
  const tags = new Set<string>([claim.category]);
  const text = `${claim.merchant} ${claim.purpose} ${claim.attendees} ${claim.receiptText ?? ""}`;
  for (const [pattern, tag] of KEYWORDS) if (pattern.test(text)) tags.add(tag);
  // "Sarah Lee (Acme Corp)": a named outside company means a client was there.
  if (/\([A-Z][A-Za-z&.' ]+\)/.test(`${claim.purpose} ${claim.attendees}`)) tags.add("client");

  // datetime is local London time, "YYYY-MM-DDTHH:mm".
  const hour = Number(claim.datetime.slice(11, 13));
  if (claim.category === "taxi" && hour >= 19 && hour < 21) tags.add("evening");
  if (claim.category === "taxi" && (hour >= 21 || hour < 6)) tags.add("late-night");
  if (claim.amount <= 25) tags.add("small");
  if (claim.headcount > 0 && claim.category === "meals") {
    tags.add(claim.amount / claim.headcount > 30 ? "over-team-cap" : "within-team-cap");
  }
  return [...tags];
}

// Precedents in the same category that share at least two other tags, best
// matches first.
export function relevantPrecedents(
  claim: Claim,
  precedents: Precedent[],
  limit = 5,
): Precedent[] {
  const tags = new Set(tagClaim(claim));
  return precedents
    .filter((p) => p.tags[0] === claim.category)
    .map((p) => ({ p, score: p.tags.slice(1).filter((t) => tags.has(t)).length }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score || b.p.createdAt.localeCompare(a.p.createdAt))
    .slice(0, limit)
    .map(({ p }) => p);
}

export function summariseClaim(claim: Claim): string {
  const who = claim.attendees ? ` with ${claim.attendees}` : "";
  return `${claim.category} at ${claim.merchant}, £${claim.amount.toFixed(2)}, ${claim.headcount} people${who} — ${claim.purpose}`;
}
