import type { Claim } from "@/lib/types";

// The four people in the office, and the claim each one actually submits.
// Spoken lines are what they say; the claim is what the model reviews.
export type Encounter = {
  id: string;
  line: string;
  claim: Omit<Claim, "id" | "createdAt">;
};

export const ENCOUNTERS: Encounter[] = [
  {
    id: "priya",
    line: "Took the team and Jamie, our freelance designer, to Dishoom. £236. Can I claim it?",
    claim: {
      source: "game",
      employee: "Priya Shah",
      category: "meals",
      merchant: "Dishoom, Shoreditch",
      amount: 236,
      datetime: "2026-10-21T19:40",
      headcount: 5,
      attendees: "Northwind team (4) and Jamie Fox, freelance designer",
      purpose: "Dinner with the team and our freelance designer",
      receipt: true,
    },
  },
  {
    id: "rosa",
    line: "Taxi home at 20:30 after the client dinner. £38.",
    claim: {
      source: "game",
      employee: "Rosa Alvarez",
      category: "taxi",
      merchant: "Addison Lee",
      amount: 38,
      datetime: "2026-10-21T20:30",
      headcount: 1,
      attendees: "",
      purpose: "Home straight after client dinner with Acme Corp",
      receipt: true,
    },
  },
  {
    id: "mei",
    line: "Lost the receipt for the printer ink, sorry! £24.",
    claim: {
      source: "game",
      employee: "Mei Chen",
      category: "other",
      merchant: "Ryman",
      amount: 24,
      datetime: "2026-10-22T11:00",
      headcount: 1,
      attendees: "",
      purpose: "Printer ink for the office",
      receipt: false,
    },
  },
  {
    id: "gerald",
    line: "Train to the Leeds office, booked last minute. £142.",
    claim: {
      source: "game",
      employee: "Gerald Holt",
      category: "rail",
      merchant: "LNER",
      amount: 142,
      datetime: "2026-10-20T07:15",
      headcount: 1,
      attendees: "",
      purpose: "Standard-class train to the Leeds office, booked the same morning",
      receipt: true,
      receiptText: "LNER standard single, London Kings Cross to Leeds",
    },
  },
];

export function encounter(id: string): Encounter | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}
