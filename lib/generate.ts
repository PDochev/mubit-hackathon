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

// Varied claims: the same policy situations, plus boundary and contrast cases,
// written from a vocabulary. Training (set 3) and the unseen eval (set 4) use
// disjoint vocabularies, so the eval tests wording the model never trained on.
type Vocab = {
  employees: string[];
  clients: string[];
  colleagues: string[];
  contractors: string[];
  teamRestaurants: string[];
  clientRestaurants: string[];
  cafes: string[];
  taxis: string[];
  ukHotels: (readonly [string, string])[];
  londonHotels: string[];
  software: string[];
  stationers: string[];
  wellbeing: [string[], string[]];
  fines: [string[], string[]];
  personal: [string[], string[]];
  teamLunch: string[];
  teamDinner: string[];
  teamDrinks: string[];
  clientMeal: string[];
  clientWine: string[];
  vagueClients: string[];
  lateTaxi: string[];
  dayTaxi: string[];
  earlyTaxi: string[];
  airportTaxi: string[];
  kitTaxi: string[];
  teamEveningTaxi: string[];
  supplies: string[];
  smallPurchase: string[];
  softwarePurpose: string[];
  informalApproval: string[];
  ukHotelPurpose: string[];
  londonHotelPurpose: string[];
  standardRail: [string, string][];
  longFirst: [string, string][];
  shortFirst: [string, string][];
  contractorDinner: string[];
  clientTaxi: string[];
  clientCoffee: string[];
  coffeeAttendees: string[];
};

const TRAIN_VOCAB: Vocab = {
  employees: ["Ana Silva", "Marcus Reid", "Yuki Tanaka", "Fatima Noor", "George Evans", "Leah Cohen", "Omar Haddad", "Ruby Walsh", "Sanjay Rao", "Tess Morgan", "Victor Lund", "Zara Ahmed"],
  clients: ["Ellen Ward (Cobalt Media)", "Rahul Nair (Fairfield Pharma)", "Claire Dubois (Meridian Hotels)", "Kwame Asante (Tidewater Logistics)", "Ingrid Holm (Nordlys Shipping)", "Paul Byrne (Granite Insurance)", "Mina Park (Solace Health)", "Diego Alvarez (Atlas Foods)"],
  colleagues: ["a colleague from our sales team", "Ruth Adams from our account team"],
  contractors: ["Lena Vogel (contractor, UX researcher)", "Marco Bianchi (freelance photographer)", "Kofi Mensah (contractor, QA engineer)", "Ivy Chen (freelance motion designer)"],
  teamRestaurants: ["Nando's", "Itsu", "Mildreds", "Padella", "Bone Daddies", "Hoppers", "Kricket", "Tortilla"],
  clientRestaurants: ["Clos Maggiore", "Rules", "Bob Bob Ricard", "Kiln", "Barrafina", "Galvin La Chapelle", "The Wolseley", "Smith & Wollensky"],
  cafes: ["Gail's", "Workshop Coffee", "Joe & The Juice", "Watch House"],
  taxis: ["Uber", "Bolt", "Addison Lee", "FREENOW"],
  ukHotels: [["Moxy Glasgow Merchant City", "Glasgow"], ["Hampton by Hilton Cardiff", "Cardiff"], ["Malmaison Newcastle", "Newcastle"], ["Titanic Hotel Liverpool", "Liverpool"], ["Leonardo Hotel Belfast", "Belfast"]],
  londonHotels: ["Premier Inn London City Aldgate", "The Resident Covent Garden", "Hilton London Bankside", "Travelodge London Central Southwark"],
  software: ["Canva Pro", "GitHub Copilot", "Postman", "Adobe Acrobat Pro", "Calendly", "Airtable"],
  stationers: ["WHSmith", "Staples", "Amazon Business"],
  wellbeing: [["Calm", "ClassPass", "Peloton", "Nuffield Health"], ["Annual meditation app subscription", "Monthly fitness class credits", "Personal training sessions"]],
  fines: [["City of London Corporation", "TfL Penalty Charge", "Islington Council"], ["Bus lane fine on the way to the client", "Parking penalty at the event venue", "Penalty fare on the Elizabeth line"]],
  personal: [["Superdrug", "Marks & Spencer", "Apple Store"], ["Sunglasses for the offsite", "Headphones for personal use", "Birthday gift for my partner"]],
  teamLunch: ["Lunch for the analytics team after the quarterly review", "Farewell lunch for a leaver", "Lunch during the security audit day", "Pizza lunch for the on-call rota", "Lunch with the new interns"],
  teamDinner: ["Team dinner after the product demo day", "Dinner for the finance team after year-end close", "Team dinner after the customer conference", "Leaving dinner for the head of design"],
  teamDrinks: ["2x glasses of prosecco £16.00", "Jug of sangria £24.00", "4x pints of lager £26.00", "Bottle of rosé £29.00"],
  clientMeal: ["Dinner with the client to agree the statement of work", "Lunch with the client after the steering committee", "Dinner with the client's procurement team", "Client dinner to kick off phase two"],
  clientWine: ["Bottle of Malbec £52.00", "2x glasses of champagne £30.00", "Bottle of Chablis £58.00"],
  vagueClients: ["the client's project team, plus me", "three people from the client, plus me", "our main contact and her manager, plus me"],
  lateTaxi: ["Home after the late quarter-end close", "Home after the overnight database migration", "Home after the evening release ran late", "Home after working late on the bid deadline"],
  dayTaxi: ["To a lunch meeting in Soho", "From the office to the bank in Moorgate", "Running late for the supplier meeting in Holborn", "To the client's office in Hammersmith"],
  earlyTaxi: ["To the office for the 7:30 all-hands", "To the client site for an 8am workshop", "To the station for the morning train"],
  airportTaxi: ["To London City Airport for the Amsterdam trip, with luggage", "From Luton after the Barcelona conference, with a suitcase", "To Heathrow Terminal 5 for the New York visit, with luggage"],
  kitTaxi: ["Carrying the exhibition banners to Olympia", "Taking three laptops and a projector to the training venue", "Moving the podcast recording kit to the studio"],
  teamEveningTaxi: ["Home after team drinks", "Home after the team's leaving do", "Home after the office quiz night"],
  supplies: ["Whiteboard markers and sticky notes for the design sprint", "Envelopes and postage for the customer mailout", "Ring binders for the audit pack"],
  smallPurchase: ["Batteries for the presentation clicker", "HDMI adapter for the meeting room", "Printer ink for the team printer"],
  softwarePurpose: ["One seat for the new engineer", "Monthly plan for the marketing team", "Annual licence for the legal team"],
  informalApproval: ["Manager approved it on Slack", "Approved verbally by my line manager", "My team lead said it was fine"],
  ukHotelPurpose: ["One night for the {city} customer workshop", "One night for the {city} office opening"],
  londonHotelPurpose: ["One night before the 8am investor meeting", "One night during the London partner summit"],
  standardRail: [["Thameslink", "Standard class return to Cambridge for the client meeting"], ["Southern", "Standard class to Gatwick for the supplier visit"], ["Chiltern Railways", "Standard class return to Oxford for the workshop"]],
  longFirst: [["Avanti West Coast", "First class London Euston to Glasgow (4h30) for the Glasgow client visit"], ["GWR", "First class London Paddington to Penzance (5h) for the site survey"], ["LNER", "First class London King's Cross to Inverness (8h) for the conference"]],
  shortFirst: [["LNER", "First class London King's Cross to York (1h50) for the audit"], ["Greater Anglia", "First class London Liverpool Street to Norwich (1h50) for the client workshop"], ["GWR", "First class London Paddington to Oxford (1h) for the board meeting"]],
  contractorDinner: ["Dinner with the team and our contractor after the launch", "Team dinner including our freelancer at the end of the sprint", "Wrap-up dinner with the squad and our contractor"],
  clientTaxi: ["Home straight after dinner with {client}", "Home after the reception with {client}", "Home after client drinks with {client}"],
  clientCoffee: ["Coffee with a prospective client before the demo", "Coffee with a customer's head of operations", "Coffee with a prospect from a logistics firm"],
  coffeeAttendees: ["a prospective client", "a prospect", "one person from a customer"],
};

// No person, client, merchant or phrasing here appears in TRAIN_VOCAB or the
// original templates (only a few rail operators repeat).
const EVAL_VOCAB: Vocab = {
  employees: ["Adele Moreau", "Bilal Siddiqui", "Cara Doyle", "Dev Malhotra", "Erin Walsh", "Femi Ade", "Gabriel Silva", "Holly Price", "Imran Aziz", "Julia Novak"],
  clients: ["Nora Fitzgerald (Harbourline Group)", "Samuel Osei (Quartz Analytics)", "Beatriz Lopes (Verdant Foods)", "Henrik Dahl (Fjord Capital)", "Amara Eze (Kiteworks Travel)", "Will Hartley (Sterling Mutual)"],
  colleagues: ["a colleague from our product team", "Megan Cole from our partnerships team"],
  contractors: ["Ravi Desai (interim product manager, via agency)", "Tom Hale (interim CFO)", "Priyanka Bose (agency copywriter)"],
  teamRestaurants: ["Pho", "Côte", "Wahaca", "Dim Sum Duck", "Mowgli", "Sticks'n'Sushi"],
  clientRestaurants: ["Scott's", "Sexy Fish", "Roka", "Chiltern Firehouse", "Quo Vadis", "Corrigan's Mayfair"],
  cafes: ["Origin Coffee", "Department of Coffee", "Paul", "Le Pain Quotidien"],
  taxis: ["ComCab", "Wheely", "Kabbee", "Blacklane"],
  ukHotels: [["Hotel du Vin York", "York"], ["Radisson Blu Aberdeen", "Aberdeen"], ["Village Hotel Southampton", "Southampton"], ["Jurys Inn Nottingham", "Nottingham"]],
  londonHotels: ["Strand Palace", "Clermont Charing Cross", "Holiday Inn London Kensington", "Pullman London St Pancras"],
  software: ["Slack Pro", "Asana", "Dropbox Business", "Jira Software", "HubSpot Starter"],
  stationers: ["Office Depot", "Euroffice", "Ryman Business Direct"],
  wellbeing: [["Virgin Active", "Better Gym", "F45 Training"], ["Monthly gym direct debit", "Ten-class yoga pass", "Gym joining fee"]],
  fines: [["Transport for London", "Hackney Council", "Kent Police"], ["Congestion charge late payment penalty", "Parking fine near the workshop venue", "Speeding fine from the Leeds trip"]],
  personal: [["Selfridges", "Next", "Currys"], ["New trainers", "Personal laptop bag", "Kettle for my flat"]],
  teamLunch: ["Lunch for the data team after the migration", "Lunch on the first day of the bootcamp", "Lunch to welcome the new head of sales", "Working lunch during roadmap planning"],
  teamDinner: ["Dinner for the engineering team after the outage", "Planning dinner for the ops team", "Team dinner after closing the funding round"],
  teamDrinks: ["Bottle of prosecco £32.00", "3x gin and tonic £30.00", "Round of beers £22.00"],
  clientMeal: ["Dinner with the client to celebrate the go-live", "Lunch with the client to review the pilot", "Dinner with the client's board after the AGM"],
  clientWine: ["Bottle of Barolo £70.00", "2x glasses of Pinot Noir £26.00"],
  vagueClients: ["people from the client, plus me", "the client's leadership, plus me"],
  lateTaxi: ["Home after the late investor call with San Francisco", "Home after the 23:00 deployment", "Home after the late payroll run"],
  dayTaxi: ["To the accountant's office in the City", "Back from a lunch meeting in Covent Garden", "To a recruitment fair in Islington"],
  earlyTaxi: ["To the office early to prepare the board pack", "To a breakfast meeting in Mayfair"],
  airportTaxi: ["To Gatwick North Terminal for the Madrid trip, with luggage", "From Heathrow after the Singapore visit, with two suitcases"],
  kitTaxi: ["Taking the 3D printer to the trade show", "Carrying boxes of brochures to the conference venue"],
  teamEveningTaxi: ["Home after the team's end-of-sprint drinks", "Home after the team bowling night"],
  supplies: ["Laminated signs for the customer event", "Box files for the compliance archive"],
  smallPurchase: ["USB-C cable for the demo laptop", "Pack of AA batteries for the wireless mics"],
  softwarePurpose: ["Seats for the new support hires", "Upgrade to the team plan"],
  informalApproval: ["My director okayed it by email", "Approved in the team stand-up"],
  ukHotelPurpose: ["One night for the {city} supplier audit", "One night for the {city} recruitment day"],
  londonHotelPurpose: ["One night for the London product launch", "One night before the early flight from London"],
  standardRail: [["Southeastern", "Standard class return to Canterbury for the client visit"], ["c2c", "Standard class to Southend for the site visit"]],
  longFirst: [["Avanti West Coast", "First class London Euston to Edinburgh via Carlisle (4h45) for the audit"], ["CrossCountry", "First class Bristol to Edinburgh (6h) for the partner summit"]],
  shortFirst: [["Southeastern", "First class London to Ashford (40m) for the workshop"], ["Avanti West Coast", "First class London Euston to Birmingham (1h20) for the client meeting"]],
  contractorDinner: ["Dinner with the squad and our interim PM after the release", "Celebration dinner with the team and our agency developer", "Team dinner including our interim CFO after the audit"],
  clientTaxi: ["Home after hosting the customer dinner for {client}", "Home after the evening pitch to {client}"],
  clientCoffee: ["Flat whites with a prospective customer after the demo", "Espresso with a potential customer at the trade show", "Coffee with a sales lead from a retail chain"],
  coffeeAttendees: ["a potential customer", "a prospect from a retailer"],
};

// Claim dates more than 60 days before submission (§1).
function staleDatetime(rng: Rng): string {
  const month = pick(rng, ["06", "07"]);
  return `2026-${month}-${String(int(rng, 1, 28)).padStart(2, "0")}T${String(int(rng, 12, 14)).padStart(2, "0")}:30`;
}

function variedTemplates(v: Vocab): Template[] {
  const clients = (r: Rng, n: number) => {
    const names = new Set<string>();
    while (names.size < Math.min(n, v.clients.length)) names.add(pick(r, v.clients));
    return [...names].join(", ");
  };
  const team = (n: number) => `Northwind team (${n} people)`;
  const fill = (s: string, r: Rng) => s.replace("{client}", pick(r, v.clients));

  return [
    // §3 team meals, including the cap boundary and alcohol
    (r) => { const n = int(r, 2, 6); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [11, 27], attendees: team(n), purpose: pick(r, v.teamLunch), hours: [12, 14] }), expected: exp("approve", "§3") }; },
    (r) => { const n = int(r, 3, 6); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [30, 30], attendees: team(n), purpose: pick(r, v.teamDinner), hours: [18, 21] }), expected: exp("approve", "§3") }; },
    (r) => { const n = int(r, 3, 7); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [31, 38], attendees: team(n), purpose: pick(r, v.teamDinner), hours: [18, 21] }), expected: exp("violation", "§3") }; },
    (r) => { const n = int(r, 4, 9); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [40, 65], attendees: team(n), purpose: pick(r, v.teamDinner), hours: [18, 21] }), expected: exp("violation", "§3") }; },
    (r) => { const n = int(r, 3, 6); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [18, 27], attendees: team(n), purpose: pick(r, v.teamDinner), receiptText: `Food for ${n}, ${pick(r, v.teamDrinks)}`, hours: [18, 21] }), expected: exp("violation", "§3") }; },
    (r) => { const n = int(r, 3, 6); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [12, 25], attendees: team(n), purpose: pick(r, v.teamLunch), receipt: false, hours: [12, 14] }), expected: exp("needs_info", "§2") }; },
    (r) => ({ ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: 2, perHead: [4, 12], attendees: team(2), purpose: pick(r, v.teamLunch), receipt: false, hours: [12, 14] }), expected: exp("approve", "§2") }),
    (r) => { const n = int(r, 3, 5); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [14, 27], attendees: `Northwind team (${n - 1} people) and ${pick(r, v.contractors)}`, purpose: pick(r, v.teamLunch), hours: [12, 14] }), expected: exp("approve", "§3") }; },
    (r) => { const n = int(r, 3, 5); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [12, 25], attendees: team(n), purpose: pick(r, v.teamLunch) }), datetime: staleDatetime(r), expected: exp("violation", "§1") }; },
    // §4 client entertainment, including the cap boundary and mixed groups
    (r) => { const n = int(r, 2, 4); return { ...meal(r, { merchant: pick(r, v.clientRestaurants), headcount: n, perHead: [40, 76], attendees: `${clients(r, n - 1)}, plus me`, purpose: pick(r, v.clientMeal), hours: [12, 21] }), expected: exp("approve", "§4") }; },
    (r) => { const n = int(r, 2, 4); return { ...meal(r, { merchant: pick(r, v.clientRestaurants), headcount: n, perHead: [45, 75], attendees: `${clients(r, n - 1)}, plus me`, purpose: pick(r, v.clientMeal), receiptText: `Mains x${n}, ${pick(r, v.clientWine)}, service 12.5%`, hours: [18, 21] }), expected: exp("approve", "§4") }; },
    (r) => { const n = int(r, 2, 4); return { ...meal(r, { merchant: pick(r, v.clientRestaurants), headcount: n, perHead: [80, 80], attendees: `${clients(r, n - 1)}, plus me`, purpose: pick(r, v.clientMeal), hours: [18, 21] }), expected: exp("approve", "§4") }; },
    (r) => { const n = int(r, 2, 4); return { ...meal(r, { merchant: pick(r, v.clientRestaurants), headcount: n, perHead: [86, 130], attendees: `${clients(r, n - 1)}, plus me`, purpose: pick(r, v.clientMeal), hours: [18, 21] }), expected: exp("violation", "§4") }; },
    (r) => ({ ...meal(r, { merchant: pick(r, v.clientRestaurants), headcount: int(r, 3, 4), perHead: [45, 75], attendees: pick(r, v.vagueClients), purpose: pick(r, v.clientMeal), hours: [12, 21] }), expected: exp("needs_info", "§4") }),
    (r) => ({ ...meal(r, { merchant: pick(r, v.clientRestaurants), headcount: 3, perHead: [45, 75], attendees: `${clients(r, 1)}, ${pick(r, v.colleagues)}, plus me`, purpose: pick(r, v.clientMeal), hours: [12, 21] }), expected: exp("approve", "§4") }),
    // §5 taxis, including just outside the allowed hours
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 14 + r() * 26, [21, 23], pick(r, v.lateTaxi)), expected: exp("approve", "§5") }),
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 16 + r() * 22, [0, 5], pick(r, v.lateTaxi)), expected: exp("approve", "§5") }),
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 9 + r() * 16, [9, 17], pick(r, v.dayTaxi)), expected: exp("violation", "§5") }),
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 12 + r() * 16, [6, 7], pick(r, v.earlyTaxi)), expected: exp("violation", "§5") }),
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 40 + r() * 45, [5, 9], pick(r, v.airportTaxi)), expected: exp("approve", "§5") }),
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 18 + r() * 25, [9, 16], pick(r, v.kitTaxi)), expected: exp("approve", "§5") }),
    (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 14 + r() * 20, [19, 20], pick(r, v.teamEveningTaxi)), expected: exp("violation", "§5") }),
    // §2 receipts
    (r) => ({ ...simple(r, "other", pick(r, v.stationers), 30 + r() * 45, [9, 17], pick(r, v.supplies), { receipt: false }), expected: exp("needs_info", "§2") }),
    (r) => ({ ...simple(r, "other", pick(r, v.stationers), 5 + r() * 18, [9, 17], pick(r, v.smallPurchase), { receipt: false }), expected: exp("approve", "§2") }),
    // §8 software
    (r) => ({ ...simple(r, "software", pick(r, v.software), 8 + r() * 45, [9, 17], pick(r, v.softwarePurpose), { approvalRef: `APR-${int(r, 1000, 9999)}`, receipt: true }), expected: exp("approve", "§8") }),
    (r) => ({ ...simple(r, "software", pick(r, v.software), 8 + r() * 40, [9, 17], pick(r, v.softwarePurpose), { receipt: true }), expected: exp("needs_info", "§8") }),
    (r) => ({ ...simple(r, "software", pick(r, v.software), 8 + r() * 40, [9, 17], `${pick(r, v.softwarePurpose)}. ${pick(r, v.informalApproval)}`, { receipt: true }), expected: exp("needs_info", "§8") }),
    // §7 hotels
    (r) => { const [hotel, city] = pick(r, v.ukHotels); return { ...simple(r, "hotel", hotel, 72 + r() * 45, [15, 20], pick(r, v.ukHotelPurpose).replace("{city}", city)), expected: exp("approve", "§7") }; },
    (r) => { const [hotel, city] = pick(r, v.ukHotels); return { ...simple(r, "hotel", hotel, 126 + r() * 60, [15, 20], pick(r, v.ukHotelPurpose).replace("{city}", city)), expected: exp("violation", "§7") }; },
    (r) => ({ ...simple(r, "hotel", pick(r, v.londonHotels), 110 + r() * 66, [15, 20], pick(r, v.londonHotelPurpose)), expected: exp("approve", "§7") }),
    (r) => ({ ...simple(r, "hotel", pick(r, v.londonHotels), 188 + r() * 70, [15, 20], pick(r, v.londonHotelPurpose)), expected: exp("violation", "§7") }),
    // §6 rail
    (r) => { const [op, purpose] = pick(r, v.standardRail); return { ...simple(r, "rail", op, 22 + r() * 70, [6, 18], purpose, { receiptText: "Standard class" }), expected: exp("approve", "§6") }; },
    (r) => { const [op, purpose] = pick(r, v.longFirst); return { ...simple(r, "rail", op, 180 + r() * 120, [6, 9], purpose, { receiptText: "First class advance single" }), expected: exp("approve", "§6") }; },
    (r) => { const [op, purpose] = pick(r, v.shortFirst); return { ...simple(r, "rail", op, 70 + r() * 110, [6, 9], purpose, { receiptText: "First class open return" }), expected: exp("violation", "§6") }; },
    // §9 not reimbursable
    (r) => ({ ...simple(r, "other", pick(r, v.wellbeing[0]), 10 + r() * 80, [8, 18], pick(r, v.wellbeing[1])), expected: exp("violation", "§9") }),
    (r) => ({ ...simple(r, "other", pick(r, v.fines[0]), 60 + r() * 100, [9, 18], pick(r, v.fines[1]), { receiptText: "Penalty charge notice" }), expected: exp("violation", "§9") }),
    (r) => ({ ...simple(r, "other", pick(r, v.personal[0]), 20 + r() * 90, [9, 19], pick(r, v.personal[1])), expected: exp("violation", "§9") }),

    // House rules, weighted so they recur often enough to be learned.
    ...[1, 2, 3].map((): Template => (r) => { const n = int(r, 4, 7); return { ...meal(r, { merchant: pick(r, v.teamRestaurants), headcount: n, perHead: [36, 60], attendees: `Northwind team (${n - 1} people) and ${pick(r, v.contractors)}`, purpose: pick(r, v.contractorDinner), hours: [18, 21] }), expected: exp("violation", "§3", "contractor-is-team") }; }),
    ...[1, 2, 3].map((): Template => (r) => ({ ...simple(r, "taxi", pick(r, v.taxis), 16 + r() * 24, [20, 20], fill(pick(r, v.clientTaxi), r)), expected: exp("approve", "§5", "late-client-taxi") })),
    ...[1, 2, 3].map((): Template => (r) => ({ ...simple(r, "meals", pick(r, v.cafes), 4 + r() * 16, [8, 16], pick(r, v.clientCoffee), { headcount: 2, attendees: pick(r, v.coffeeAttendees), receipt: false }), expected: exp("approve", "§4", "client-coffee") })),
  ];
}

// Boundary cases that only the unseen eval contains.
const EVAL_ONLY: Template[] = [
  (r) => ({ ...simple(r, "rail", "Avanti West Coast", 150 + r() * 60, [7, 8], "First class London Euston to Lancaster (3h00) for the client meeting", { receiptText: "First class open return" }), expected: exp("violation", "§6") }),
  (r) => ({ ...simple(r, "hotel", "Leonardo Hotel Sheffield", 120, [16, 19], "One night for the Sheffield client workshop"), expected: exp("approve", "§7") }),
  (r) => ({ ...simple(r, "taxi", "ComCab", 18 + r() * 14, [21, 21], "Home after the late product review"), datetime: `2026-10-${String(int(r, 1, 21)).padStart(2, "0")}T21:00`, expected: exp("approve", "§5") }),
  (r) => ({ ...simple(r, "taxi", "Wheely", 20 + r() * 14, [20, 20], "Home after dinner with the team"), expected: exp("violation", "§5") }),
];

// Generator sets. Seed sets train the model; eval sets are never seeded.
const SETS: Record<number, { templates: Template[]; employees: string[] }> = {
  1: { templates: TEMPLATES, employees: EMPLOYEES }, // original seed
  2: { templates: TEMPLATES, employees: EMPLOYEES }, // held-out eval, same templates
  3: { templates: variedTemplates(TRAIN_VOCAB), employees: TRAIN_VOCAB.employees }, // varied seed
  4: { templates: [...variedTemplates(EVAL_VOCAB), ...EVAL_ONLY], employees: EVAL_VOCAB.employees }, // unseen eval
};

export const SEED_SETS = [1, 3];
export const EVAL_SETS = [2, 4];

export const templateCount = (set: number) => SETS[set].templates.length;

// Claim `index` of generator set `set`. Same inputs always give the same claim.
export function generateClaim(set: number, index: number): Draft {
  const { templates, employees } = SETS[set];
  const rng = rngFor(set * 100_003 + index * 7919);
  const draft = templates[index % templates.length](rng);
  return { ...draft, employee: pick(rng, employees) };
}
