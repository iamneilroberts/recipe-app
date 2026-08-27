// THE TIER LOCK — runtime tiers are exactly `free | premium`.
//
// This module is the executable source of truth for tiers (mirrors the
// voygent-lite tier-catalog discipline). The tool catalog is locked per session
// (no tools/list_changed): a tier change takes effect on the next connect.
//
//   free    — capture / organize / cook / search / share. Costs the operator
//             nothing: the user's own Claude/GPT does all the reasoning.
//   premium — free + the metered features that carry a real marginal cost
//             (ASR video transcription, a nutrition API, household sharing).
//
// D1 stores the tier as a plain string; every read goes through normalizeTier
// so an unknown/legacy value fails CLOSED to the least-privileged tier.

export type Tier = "free" | "premium";

export const TIERS: readonly Tier[] = ["free", "premium"] as const;

export function normalizeTier(raw: string | null | undefined): Tier {
  return raw === "premium" ? "premium" : "free";
}
