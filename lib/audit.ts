import "server-only";
import type { Verdict } from "./prompt";
import type { Claim } from "./types";

// The 09:00 audit: claims the apprentice has never seen, ruled on alone.
// Half turn on the rules you taught it tonight, half on the written policy,
// and one looks like a taught case but isn't.
export type AuditCase = {
  id: string;
  title: string;
  expected: Verdict;
  claim: Omit<Claim, "id" | "createdAt">;
};

export const AUDIT: AuditCase[] = [
  {
    id: "a1",
    title: "Pizza with a contractor, £96 for 3",
    expected: "violation",
    claim: {
      source: "game",
      employee: "Tom Clarke",
      category: "meals",
      merchant: "Pizza Pilgrims",
      amount: 96,
      datetime: "2026-10-24T12:30",
      headcount: 3,
      attendees: "Northwind developers (2) and Sam Ortiz, contractor",
      purpose: "Team lunch with our contractor",
      receipt: true,
    },
  },
  {
    id: "a2",
    title: "Taxi at 20:15 after client drinks",
    expected: "approve",
    claim: {
      source: "game",
      employee: "Aisha Bello",
      category: "taxi",
      merchant: "Bolt",
      amount: 31,
      datetime: "2026-10-24T20:15",
      headcount: 1,
      attendees: "",
      purpose: "Home straight after client drinks with Globex",
      receipt: true,
    },
  },
  {
    id: "a3",
    title: "£14 coffee with a prospect, no names",
    expected: "approve",
    claim: {
      source: "game",
      employee: "Ben Okafor",
      category: "meals",
      merchant: "Caffè Nero",
      amount: 14,
      datetime: "2026-10-24T09:00",
      headcount: 2,
      attendees: "Ben Okafor and a prospect",
      purpose: "Coffee with a prospect",
      receipt: true,
    },
  },
  {
    id: "a4",
    title: "Taxi home at 19:30, no client",
    expected: "violation",
    claim: {
      source: "game",
      employee: "Chloe Martin",
      category: "taxi",
      merchant: "Addison Lee",
      amount: 24,
      datetime: "2026-10-24T19:30",
      headcount: 1,
      attendees: "",
      purpose: "Home after working late",
      receipt: true,
    },
  },
  {
    id: "a5",
    title: "Manchester hotel, £150 a night",
    expected: "violation",
    claim: {
      source: "game",
      employee: "Daniel Wu",
      category: "hotel",
      merchant: "Malmaison Manchester",
      amount: 150,
      datetime: "2026-10-24T22:00",
      headcount: 1,
      attendees: "",
      purpose: "One night in Manchester for the client workshop",
      receipt: true,
    },
  },
  {
    id: "a6",
    title: "Figma seat, no approval reference",
    expected: "needs_info",
    claim: {
      source: "game",
      employee: "Emma Hughes",
      category: "software",
      merchant: "Figma",
      amount: 45,
      datetime: "2026-10-24T11:00",
      headcount: 1,
      attendees: "",
      purpose: "Figma seat for the new designer",
      receipt: true,
    },
  },
];
