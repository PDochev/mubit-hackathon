import type { Verdict } from "./prompt";
import type { Category, Claim, HouseRuleId } from "./types";

// How Northwind's finance team rules where the written policy is silent or
// ambiguous. The model only learns these through precedents.
export const HOUSE_RULES: Record<HouseRuleId, { verdict: Verdict; reason: string }> = {
  "contractor-is-team": {
    verdict: "violation",
    reason:
      "Contractors and freelancers working with us count as team, not clients, so the £30 per head team cap (§3) applies.",
  },
  "late-client-taxi": {
    verdict: "approve",
    reason:
      "A taxi home straight after a client event is allowed from 20:00, even before 21:00 (§5).",
  },
  "client-coffee": {
    verdict: "approve",
    reason:
      "Client coffees of £25 or less don't need attendee names or companies (§4).",
  },
};

type Rng = () => number;

// mulberry32: small deterministic PRNG so seed and eval sets are reproducible.
function rngFor(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const round = (n: number) => Math.round(n * 100) / 100;

const EMPLOYEES = [
  "Priya Shah", "Tom Clarke", "Aisha Bello", "Ben Okafor", "Chloe Martin", "Daniel Wu",
  "Emma Hughes", "Felix Grant", "Grace O'Neill", "Hamza Khan", "Isla Fraser", "Jonas Berg",
  "Kemi Adeyemi", "Liam Murphy", "Mei Lin", "Noah Patel", "Olivia Brooks", "Rafael Costa",
];
const CLIENTS = [
  "Sarah Lee (Acme Corp)", "James Patel (Halcyon Bank)", "Maria Rossi (Brightwave)",
  "Oliver Stone (Kestrel Insurance)", "Hannah Kim (Lumen Health)", "David Mensah (Orbital Freight)",
  "Sophie Turner (Northgate Capital)", "Arjun Mehta (Pinecone Retail)", "Laura Schmidt (Vireo Energy)",
  "Tom Becker (Quayside Legal)",
];
const CONTRACTORS = [
  "Jamie Fox (freelance designer, contractor)", "Alex Rivera (contractor, developer)",
  "Sam Taylor (freelance copywriter)", "Nadia Petrova (contractor, data engineer)",
  "Chris Owen (freelance video editor)",
];
const TEAM_RESTAURANTS = ["Wagamama", "Dishoom", "Leon", "Franco Manca", "Honest Burgers", "Busaba", "Rosa's Thai", "Bao", "Flat Iron", "Pizza Pilgrims"];
const CLIENT_RESTAURANTS = ["Hawksmoor", "Dishoom", "The Ivy", "Gymkhana", "Sketch", "Hakkasan", "Duck & Waffle", "Coal Office", "St. JOHN", "Brat"];
const CAFES = ["Pret A Manger", "Starbucks", "Grind", "Black Sheep Coffee", "Caffè Nero", "Gail's", "Monmouth Coffee", "Costa"];
const TAXIS = ["Uber", "Addison Lee", "Bolt", "FREENOW", "Gett", "Veezu"];
const CITY_HOTELS = [
  ["Premier Inn Manchester Central", "Manchester"], ["Hotel Indigo Birmingham", "Birmingham"],
  ["Novotel Leeds Centre", "Leeds"], ["Motel One Edinburgh", "Edinburgh"], ["Hilton Bristol", "Bristol"],
] as const;
const LONDON_HOTELS = ["Hub by Premier Inn London Bank", "citizenM Tower of London", "Hoxton Holborn", "Point A Hotel Liverpool Street"];
const SOFTWARE = ["Figma", "Notion", "Loom", "Miro", "Linear", "Grammarly Business", "Zoom Workplace", "1Password Teams"];

const TEAM_LUNCH = ["Team lunch after sprint review", "Lunch for the onboarding cohort", "Team lunch during the planning offsite", "Retro lunch with the platform team", "Welcome lunch for two new joiners"];
const TEAM_DINNER = ["Team dinner to celebrate the launch", "End-of-quarter team dinner", "Dinner for the support team after the migration weekend", "Team dinner after the hackathon"];
const CLIENT_DINNER = ["Dinner with client to discuss contract renewal", "Client dinner after the pitch", "Dinner with the client's leadership team", "Relationship dinner ahead of the RFP", "Dinner with client after the quarterly business review"];
const LATE_TAXI = ["Home after a late production release", "Home after the incident call ran past midnight", "Home after the late board pack deadline", "Home after the evening launch event"];
const DAY_TAXI = ["To the client office in Shoreditch for a meeting", "From Liverpool Street to a meeting in Canary Wharf", "To a supplier meeting in Kings Cross", "Back to the office after lunch with a colleague"];

function datetime(rng: Rng, hourMin: number, hourMax: number): string {
  const day = String(int(rng, 1, 21)).padStart(2, "0");
  const hour = String(int(rng, hourMin, hourMax)).padStart(2, "0");
  const minute = String(pick(rng, [0, 5, 10, 15, 20, 25, 30, 40, 45, 50, 55])).padStart(2, "0");
  return `2026-10-${day}T${hour}:${minute}`;
}

type Draft = Omit<Claim, "id" | "createdAt" | "source">;
type Body = Omit<Draft, "expected" | "employee">;

function meal(
  rng: Rng,
  opts: { merchant: string; headcount: number; perHead: [number, number]; attendees: string; purpose: string; receiptText?: string; receipt?: boolean; hours?: [number, number] },
): Body {
  const amount = round(opts.headcount * (opts.perHead[0] + rng() * (opts.perHead[1] - opts.perHead[0])));
  return {
    category: "meals",
    merchant: opts.merchant,
    amount,
    datetime: datetime(rng, ...(opts.hours ?? [12, 21])),
    headcount: opts.headcount,
    attendees: opts.attendees,
    purpose: opts.purpose,
    receipt: opts.receipt ?? true,
    receiptText: opts.receiptText,
  };
}

function simple(
  rng: Rng,
  category: Category,
  merchant: string,
  amount: number,
  hours: [number, number],
  purpose: string,
  extra: Partial<Draft> = {},
): Body {
  return {
    category,
    merchant,
    amount: round(amount),
    datetime: datetime(rng, hours[0], hours[1]),
    headcount: 1,
    attendees: "",
    purpose,
    receipt: amount > 25,
    ...extra,
  };
}

const clientList = (rng: Rng, n: number) => {
  const names = new Set<string>();
  while (names.size < n) names.add(pick(rng, CLIENTS));
  return [...names].join(", ");
};

type Template = (rng: Rng) => Omit<Draft, "employee">;

const exp = (verdict: Verdict, clause: string, houseRule?: HouseRuleId) => ({ verdict, clause, houseRule });

const TEMPLATES: Template[] = [
  // §3 team meals
  (r) => {
    const n = int(r, 3, 7);
    return { ...meal(r, { merchant: pick(r, TEAM_RESTAURANTS), headcount: n, perHead: [12, 28], attendees: `Northwind team (${n} people)`, purpose: pick(r, TEAM_LUNCH), hours: [12, 14] }), expected: exp("approve", "§3") };
  },
  (r) => {
    const n = int(r, 4, 9);
    return { ...meal(r, { merchant: pick(r, TEAM_RESTAURANTS), headcount: n, perHead: [34, 52], attendees: `Northwind team (${n} people)`, purpose: pick(r, TEAM_DINNER), hours: [18, 21] }), expected: exp("violation", "§3") };
  },
  (r) => {
    const n = int(r, 3, 6);
    const drinks = pick(r, ["2x Peroni £11.00", "Bottle of house red £28.00", "3x Aperol spritz £27.00", "4x Camden Hells £24.00"]);
    return { ...meal(r, { merchant: pick(r, TEAM_RESTAURANTS), headcount: n, perHead: [18, 28], attendees: `Northwind team (${n} people)`, purpose: pick(r, TEAM_DINNER), receiptText: `Food for ${n}, ${drinks}, service 12.5%`, hours: [18, 21] }), expected: exp("violation", "§3") };
  },
  (r) => {
    const n = int(r, 3, 6);
    return { ...meal(r, { merchant: pick(r, TEAM_RESTAURANTS), headcount: n, perHead: [12, 25], attendees: `Northwind team (${n} people)`, purpose: pick(r, TEAM_LUNCH), receipt: false, hours: [12, 14] }), expected: exp("needs_info", "§2") };
  },
  // §4 client entertainment
  (r) => {
    const n = int(r, 2, 4);
    return { ...meal(r, { merchant: pick(r, CLIENT_RESTAURANTS), headcount: n, perHead: [40, 78], attendees: `${clientList(r, n - 1)}, plus me`, purpose: pick(r, CLIENT_DINNER), hours: [18, 21] }), expected: exp("approve", "§4") };
  },
  (r) => {
    const n = int(r, 2, 4);
    const wine = pick(r, ["Bottle of Rioja £48.00", "2x champagne £36.00", "Bottle of Sancerre £55.00"]);
    return { ...meal(r, { merchant: pick(r, CLIENT_RESTAURANTS), headcount: n, perHead: [45, 75], attendees: `${clientList(r, n - 1)}, plus me`, purpose: pick(r, CLIENT_DINNER), receiptText: `Mains x${n}, ${wine}, service 12.5%`, hours: [18, 21] }), expected: exp("approve", "§4") };
  },
  (r) => ({ ...meal(r, { merchant: pick(r, CLIENT_RESTAURANTS), headcount: 3, perHead: [50, 75], attendees: pick(r, ["Sarah and James from the client, plus me", "two people from the client, plus me", "the client's CFO and COO, plus me"]), purpose: pick(r, CLIENT_DINNER), hours: [18, 21] }), expected: exp("needs_info", "§4") }),
  (r) => {
    const n = int(r, 2, 4);
    return { ...meal(r, { merchant: pick(r, CLIENT_RESTAURANTS), headcount: n, perHead: [92, 140], attendees: `${clientList(r, n - 1)}, plus me`, purpose: pick(r, ["Celebration dinner with client after signing", "Tasting menu with client after the renewal", ...CLIENT_DINNER]), hours: [18, 21] }), expected: exp("violation", "§4") };
  },
  // §5 taxis
  (r) => ({ ...simple(r, "taxi", pick(r, TAXIS), 14 + r() * 26, [21, 23], pick(r, LATE_TAXI)), expected: exp("approve", "§5") }),
  (r) => ({ ...simple(r, "taxi", pick(r, TAXIS), 16 + r() * 20, [0, 2], pick(r, LATE_TAXI)), expected: exp("approve", "§5") }),
  (r) => ({ ...simple(r, "taxi", pick(r, TAXIS), 9 + r() * 16, [9, 17], pick(r, DAY_TAXI)), expected: exp("violation", "§5") }),
  (r) => ({ ...simple(r, "taxi", pick(r, TAXIS), 45 + r() * 30, [5, 8], pick(r, ["To Heathrow for the Berlin trip, with luggage", "From Gatwick after the Lisbon conference, with a suitcase", "To Stansted for the Dublin client visit, with luggage"])), expected: exp("approve", "§5") }),
  (r) => ({ ...simple(r, "taxi", pick(r, TAXIS), 18 + r() * 20, [10, 16], pick(r, ["Carrying two demo monitors to the client workshop", "Taking the trade-show stand and kit to ExCeL", "Moving heavy AV equipment to the offsite venue"])), expected: exp("approve", "§5") }),
  // §2 receipts
  (r) => ({ ...simple(r, "other", pick(r, ["Ryman", "Rymans", "Viking Direct"]), 32 + r() * 40, [9, 17], pick(r, ["Printer paper and folders for the client workshop", "Flipchart pads and markers for the offsite", "Name badges and lanyards for the customer event"]), { receipt: false }), expected: exp("needs_info", "§2") }),
  (r) => ({ ...simple(r, "meals", pick(r, CAFES), 3 + r() * 7, [7, 10], pick(r, ["Coffee on the way to the Bristol office", "Breakfast coffee before the early client workshop", "Coffee while travelling to the Leeds office"])), expected: exp("approve", "§2") }),
  // §8 software
  (r) => ({ ...simple(r, "software", pick(r, SOFTWARE), 8 + r() * 40, [9, 17], pick(r, ["One editor seat for the design sprint", "Licence for the new analyst", "Monthly plan for the research team"]), { approvalRef: `APR-${int(r, 1000, 9999)}`, receipt: true }), expected: exp("approve", "§8") }),
  (r) => ({ ...simple(r, "software", pick(r, SOFTWARE), 8 + r() * 30, [9, 17], pick(r, ["Team workspace subscription", "Extra seats for the contractors", "Annual plan upgrade"]), { receipt: true }), expected: exp("needs_info", "§8") }),
  // §7 hotels
  (r) => {
    const [hotel, city] = pick(r, CITY_HOTELS);
    return { ...simple(r, "hotel", hotel, 128 + r() * 50, [15, 20], `One night for the ${city} client workshop`), expected: exp("violation", "§7") };
  },
  (r) => {
    const [hotel, city] = pick(r, CITY_HOTELS);
    return { ...simple(r, "hotel", hotel, 75 + r() * 40, [15, 20], `One night for the ${city} office visit`), expected: exp("approve", "§7") };
  },
  (r) => ({ ...simple(r, "hotel", pick(r, LONDON_HOTELS), 140 + r() * 38, [15, 20], "One night before the early London board meeting"), expected: exp("approve", "§7") }),
  (r) => ({ ...simple(r, "hotel", pick(r, LONDON_HOTELS), 195 + r() * 60, [15, 20], "One night in London during the sales kickoff"), expected: exp("violation", "§7") }),
  // §6 rail
  (r) => ({ ...simple(r, "rail", pick(r, ["Avanti West Coast", "CrossCountry", "GWR"]), 160 + r() * 80, [6, 9], pick(r, ["First class London Euston to Manchester (2h10) for client workshop", "First class London Paddington to Bristol (1h40) for the office visit", "First class Birmingham to London (1h25) for the board meeting"]), { receiptText: "First class open return" }), expected: exp("violation", "§6") }),
  (r) => ({ ...simple(r, "rail", "LNER", 190 + r() * 90, [6, 9], pick(r, ["First class London King's Cross to Edinburgh (4h20) for the Edinburgh office visit", "First class London King's Cross to Aberdeen (7h) for the client site visit", "First class London to Newcastle and on to Edinburgh (4h30) for the audit"]), { receiptText: "First class advance single" }), expected: exp("approve", "§6") }),
  (r) => ({ ...simple(r, "rail", pick(r, ["Southeastern", "Thameslink", "GWR", "Avanti West Coast"]), 25 + r() * 90, [6, 18], pick(r, ["Standard class return to the Brighton client office", "Standard class to Reading for the supplier meeting", "Standard class return to Manchester for the workshop"]), { receiptText: "Standard class" }), expected: exp("approve", "§6") }),
  // §9 not reimbursable
  (r) => ({ ...simple(r, "other", pick(r, ["PureGym", "Third Space", "Headspace", "Gymbox"]), 12 + r() * 60, [8, 18], pick(r, ["Monthly gym membership", "Wellbeing app annual plan", "Fitness class pass"])), expected: exp("violation", "§9") }),
  (r) => ({ ...simple(r, "other", pick(r, ["Westminster City Council", "TfL Congestion Charge PCN", "Camden Council"]), 65 + r() * 100, [9, 18], pick(r, ["Parking fine outside the client office", "Penalty charge for the congestion zone", "Parking ticket during the site visit"]), { receiptText: "Penalty charge notice" }), expected: exp("violation", "§9") }),
  (r) => ({ ...simple(r, "other", pick(r, ["Boots", "Uniqlo", "John Lewis"]), 18 + r() * 45, [9, 19], pick(r, ["Toiletries forgotten on the Manchester trip", "Replacement shirt before the client pitch", "Phone charger for personal use"])), expected: exp("violation", "§9") }),

  // House-rule cases, weighted so they recur often enough to be learned.
  ...[1, 2, 3].map((): Template => (r) => {
    const n = int(r, 4, 7);
    return { ...meal(r, { merchant: pick(r, TEAM_RESTAURANTS), headcount: n, perHead: [36, 58], attendees: `Northwind team (${n - 1} people) and ${pick(r, CONTRACTORS)}`, purpose: pick(r, ["Dinner with the team and our freelancer after the rebrand", "Team dinner including our contractor to wrap up the project", "Dinner with the squad and our contractor after go-live"]), hours: [18, 21] }), expected: exp("violation", "§3", "contractor-is-team") };
  }),
  ...[1, 2, 3].map((): Template => (r) => ({ ...simple(r, "taxi", pick(r, TAXIS), 16 + r() * 22, [20, 20], pick(r, [`Home straight after client dinner with ${pick(r, CLIENTS)}`, `Home after drinks with ${pick(r, CLIENTS)}`, `Home after the client event hosted for ${pick(r, CLIENTS)}`])), expected: exp("approve", "§5", "late-client-taxi") })),
  ...[1, 2, 3].map((): Template => (r) => ({ ...simple(r, "meals", pick(r, CAFES), 5 + r() * 14, [8, 16], pick(r, ["Coffee with a prospect from a fintech startup", "Coffee with a potential client after the meetup", "Quick coffee with a prospect we met at the conference", "Coffee catch-up with a customer's product lead"]), { headcount: 2, attendees: pick(r, ["a prospective client", "a prospect", "one person from a customer"]), receipt: false }), expected: exp("approve", "§4", "client-coffee") })),
];

export const TEMPLATE_COUNT = TEMPLATES.length;

// Claim `index` of set `set` (1 = seed, 2 = held-out eval). Same inputs always
// give the same claim.
export function generateClaim(set: number, index: number): Draft {
  const rng = rngFor(set * 100_003 + index * 7919);
  const draft = TEMPLATES[index % TEMPLATES.length](rng);
  return { ...draft, employee: pick(rng, EMPLOYEES) };
}
