import type { Claim } from "@/lib/types";

// The night in two rounds. Round 1 (from 23:00) meets the policy's gaps for
// the first time; round 2 (from 03:00) brings claims that turn on the same
// rules, so you can see what the apprentice learned. The 09:00 audit's
// claims stay on the server (lib/audit.ts).
// Spoken lines are what they say; the claim is what the model reviews.
export type Encounter = {
  id: string;
  round: 1 | 2;
  line: string;
  claim: Omit<Claim, "id" | "createdAt">;
};

export const ENCOUNTERS: Encounter[] = [
  {
    id: "priya",
    round: 1,
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
    round: 1,
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
    round: 1,
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
    round: 1,
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
  {
    id: "priya-2",
    round: 2,
    line: "Lunch for the design team and our two agency freelancers. £186 at Flat Iron.",
    claim: {
      source: "game",
      employee: "Priya Shah",
      category: "meals",
      merchant: "Flat Iron, Covent Garden",
      amount: 186,
      datetime: "2026-10-23T13:00",
      headcount: 5,
      attendees: "Northwind design team (3) and two freelancers from our design agency",
      purpose: "Working lunch with the design team and agency freelancers",
      receipt: true,
    },
  },
  {
    id: "rosa-2",
    round: 2,
    line: "Uber home at 20:45, straight from the Hooli launch event. £27.",
    claim: {
      source: "game",
      employee: "Rosa Alvarez",
      category: "taxi",
      merchant: "Uber",
      amount: 27,
      datetime: "2026-10-23T20:45",
      headcount: 1,
      attendees: "",
      purpose: "Home straight after the client launch event at Hooli",
      receipt: true,
    },
  },
  {
    id: "sam",
    round: 2,
    line: "Coffee with a client from Initech, £12. Didn't catch her surname.",
    claim: {
      source: "game",
      employee: "Sam Patel",
      category: "meals",
      merchant: "Costa Coffee",
      amount: 12,
      datetime: "2026-10-23T09:30",
      headcount: 2,
      attendees: "Sam Patel and a client",
      purpose: "Coffee with a client (Initech)",
      receipt: true,
    },
  },
];

export function encounter(id: string): Encounter | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

export const ROUND_1 = ENCOUNTERS.filter((e) => e.round === 1);
export const ROUND_2 = ENCOUNTERS.filter((e) => e.round === 2);
