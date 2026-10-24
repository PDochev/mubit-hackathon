import type { ClaimRecord } from "./types";

export type ClaimStatus = "error" | "pending" | "needs_review" | "auto_approved" | "approved" | "overridden";

export function claimStatus(claim: ClaimRecord): ClaimStatus {
  if (claim.final?.by === "auto") return "auto_approved";
  if (claim.final) return claim.final.verdict !== claim.firstPass?.verdict ? "overridden" : "approved";
  if (claim.error) return "error";
  if (!claim.firstPass) return "pending";
  return "needs_review";
}

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  error: "Model error",
  pending: "Checking",
  needs_review: "Needs review",
  auto_approved: "Auto-approved",
  approved: "Confirmed by finance",
  overridden: "Overridden",
};

export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

// Event times, always shown in London time whatever the server's zone.
export const londonTime = (
  iso: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", ...options });
