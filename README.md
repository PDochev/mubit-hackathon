# Precedent

![Night Shift: the AI apprentice weighs a team dinner with a freelance designer](public/Night%20shift%20game.png)

![The reviewer inbox: every claim with the model's verdict, its status and whether it became a training example](public/Landing%20page.png)

**An expense-policy reviewer that learns from every finance correction.** Built at the Mubit Night Shift hackathon (London, 23–25 Oct 2026), _Recurring tasks_ track.

An employee submits an expense. The model checks it against the company policy and gives a verdict (approve, violation or needs info) with the clause it relied on. When finance disagrees, they override it and write one sentence explaining why. That sentence does two things:

1. **It applies straight away.** It's saved as a _precedent_ (P1, P2, …) and sent with every similar claim from then on, so the very next claim gets it right.
2. **It becomes a model update.** The corrected call is recorded through Mubit as a verified training example, and Mubit trains a small open model on those examples.

## Why: a recurring task nobody writes down

Written expense policies never cover everything. Is a freelancer at a team dinner "team" or "client"? Is a taxi at 20:30 after a client dinner allowed when the policy says "after 21:00"? Finance answers the same questions every week, and the answers live in people's heads. Precedent makes each answer a one-time job: the model follows it from the next claim on, and learns it permanently through Mubit.

## What the demo shows

The demo video (under 3 minutes, in our hackathon submission with the slides) follows one correction from finance's head into the model:

1. **A claim checked against policy and precedent.** An employee submits a £24.50 Uber at 20:30. The written policy only allows taxis after 21:00, but finance once ruled that a taxi straight after a client dinner is fine. The model approves it and cites that ruling, **P4**. Every call goes through Mubit.
2. **Teaching, as a game.** In Night Shift, you're finance on the night shift, training an AI apprentice. It isn't sure about a team dinner with a freelance designer. You reject it and teach it one sentence: contractors count as team, not clients. That ruling, **R1**, applies straight away and is recorded through Mubit as a verified training example, with its request ID on screen.
3. **It applies the ruling to a claim it has never seen.** At 03:00 a new claim on the same rule arrives, with a different restaurant, people and amount. The apprentice answers "USING YOUR RULING R1 · I'D REJECT" with no help.
4. **The 09:00 audit.** Six unseen claims, each asked twice: as the apprentice was at the start of the night, and with your rulings. The score goes from **3/6 to 5/6**.
5. **Proof inside Mubit.** The shift report links to the Mubit console, where the last ruling appears as a fully recorded request whose corrected answer cites the ruling.
6. **The model update.** The Learning loop page shows what Mubit's trained adapter (Qwen3-4B) learned from examples like these. On the contractor claim it gives the same verdict as the provider model and cites the precedent by itself, **4.2× faster** with **3.7× fewer tokens**.
7. **The numbers.** On 50 held-out claims, the cases only a correction can fix go from **0% to 100%**, and all claims from **74% to 90%**.

## Run it

Requires **Node 24**. A **Mubit API key** is needed only for model calls.

```bash
git clone https://github.com/PDochev/mubit-hackathon.git
cd mubit-hackathon
npm install
cp .env.example .env.local     # then paste your Mubit key into it
npm run dev                    # http://localhost:3000
```

**What you'll see straight away.** The app starts from `demo/store.json`, a snapshot of our own data: 317 claims, 3 precedents, 7 evaluation runs and 13 Night Shift games. Every page has content, and the results below can be checked on the Learning loop page without spending anything. Your changes are saved to `data/store.json` (gitignored); delete that file to go back to the snapshot.

**Without a key** you can browse everything. Anything that asks the model (submitting a claim, Night Shift, re-checks, the evaluation) shows "No Mubit API key" instead.

**With your own key**, your calls go to a new task in _your_ Mubit workspace. Our trained adapter and our training examples live in our workspace, so the adapter figures are copied into `lib/adapter-evidence.ts` and labelled as such in the app.

**Cost, in model calls:** one claim is 1–3, a full Night Shift is about 25, and the evaluation is 100.

## Try it in five minutes

1. **Submit** (`/submit`): pick the example **Taxi after client dinner** (Uber, £24.50 at 20:30) and submit it. The policy only allows taxis after 21:00, but the verdict follows finance's earlier ruling. Click **Finance view**: it cites **P4**.
2. **Inbox** (`/`): open a claim and override it with a one-sentence reason. That becomes a new precedent, and the claim is re-asked with full recording to become a training example.
3. **Night Shift** (`/play`): the same loop as a game, about two minutes. Teach the apprentice in round 1 and watch it apply your rulings in round 2 ("USING YOUR RULING R1"). Then see the 09:00 audit score before and after your rulings.
4. **Learning loop** (`/loop`): the held-out evaluation, the trained adapter's evidence, a step-by-step trace of one correction, and every recorded example with its Mubit request ID.

## How it works

```
submit ─▶ model verdict ─▶ finance confirms ──────────────▶ verified example ─▶ Mubit trains adapter
                            └─ or overrides + reason ─▶ precedent ─┘
                                                         └─▶ sent with every matching claim
```

| Step            | What happens                                                                                                                                                                         | Mubit recording           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| First pass      | System prompt + policy + matching precedents + claim, JSON verdict back. Small, receipted, confident approvals (≤ £100, ≥ 85%) are auto-approved; everything else waits for finance. | `metadata` (never trains) |
| Finance decides | Confirm, or override with a reason. An override becomes a precedent, with tags used to match it to future claims.                                                                    | —                         |
| Commit          | The claim is asked again with the ruling included and **full recording**. It only counts as a _verified_ example if the reply matches finance's verdict (one retry otherwise).       | `full` (trains)           |
| Policy edit     | Saving a new policy version re-checks every open claim and tests each precedent against the new text. A precedent the policy now covers can be retired.                              | `metadata`                |
| Evaluation      | 50 unseen claims (new people, merchants and wording), each asked with the policy alone and with the precedents.                                                                      | `metadata`                |

## How it uses Mubit

- **Every LLM call goes through Mubit**, via its OpenAI-compatible endpoint (`https://api.mubit.ai/openai/v1`, model `gpt-6-luna`). See `lib/mubit.ts`.
- **One frozen system prompt = one Mubit task.** Mubit groups calls by instructions and output format, so the system prompt and message layout in `lib/prompt.ts` are frozen. Everything that varies (policy, precedents, claim) goes in the user message.
- **Only human-checked answers train.** The `x-middleware-record` header is set per call: `metadata` for anything nobody has checked yet (first passes, re-checks, evaluations), `full` only for the commit after finance has decided, and only kept when the reply agrees with finance.
- **Every training example is traceable.** Each commit stores Mubit's request ID (`mreq_…`), shown in the inbox, in Night Shift and on the Learning loop page.
- **Mubit trains the adapter.** From these examples Mubit trained adapter v1 on Qwen3-4B, which is now in a 10% silent test against the provider model.

## Night Shift: the demo game

`/play` turns the same loop into a two-minute game. You're on the night shift at Northwind, training an AI apprentice that knows the written policy and nothing else.

1. **23:00, round 1.** Four coworkers bring claims. The apprentice stamps each one (approve, reject or needs info, with the clause). Agree with it, or stamp your own verdict and pick the one-sentence reason. Each disagreement becomes a _ruling_ (R1, R2, …) for the rest of the night.
2. **03:00, round 2.** The same kinds of cases come back with new details. The apprentice now applies your rulings unprompted.
3. **09:00 audit.** Six claims it has never seen, each asked twice: with no rulings (as it started the night) and with yours. The board shows both against the right answer.
4. **Shift report.** Agreement in round 1 vs round 2, the audit before → after, and the Mubit request ID of every recorded ruling. The Learning loop page shows the latest audited shift too.

It runs on the same engine as the inbox (`lib/game.ts`): first passes are `metadata`, and every ruling is committed with `full` recording and verified like an inbox correction, so a game is real training data. In our recorded demo run the apprentice got both round-2 repeats right on its own, the audit went from **3/6 to 5/6**, and all 7 rulings were recorded and verified.

## Results

**Instant fix: precedents** (held-out evaluation run 7, 50 claims written with people, merchants and wording that never appear in training):

|                                                    | Policy only | Policy + precedents |
| -------------------------------------------------- | ----------- | ------------------- |
| All claims                                         | 74%         | **90%**             |
| House-rule cases (only a correction can fix these) | 0%          | **100%**            |

**Permanent fix: the trained adapter** (Mubit adapter v1, Qwen3-4B, trained on our verified examples):

|                         |                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Mubit's held-out exam   | base model 0% → adapter **69%**                                                                                         |
| Live silent test        | 15 of 21 replies judged as good as the provider's (71%)                                                                 |
| Contractor dinner claim | Same verdict as GPT, and it cites precedent P2 by itself, **4.2× faster** (579 ms vs 2.43 s) with **3.7× fewer tokens** |

Training data so far: 350 verified examples (38 of them from Night Shift), 32 of them corrections.

Mubit's API doesn't expose adapter results, so the adapter figures are copied from the Mubit console into `lib/adapter-evidence.ts` and labelled as such in the app.

## The app

| Page                      |                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inbox** `/`             | Claims with the model's verdict. Open one to confirm or override it.                                                                            |
| **Submit** `/submit`      | The employee form, with four example claims the policy is unclear about.                                                                        |
| **Policy** `/policy`      | Edit the policy and see open claims re-checked, with a diff of what changed. Precedents and whether the policy now covers them.                 |
| **Learning loop** `/loop` | The evaluation, the adapter evidence, a step-by-step trace of one correction into the model, the latest Night Shift, and the recorded examples. |
| **Night Shift** `/play`   | The demo game: train the apprentice overnight, then watch the 09:00 audit. Best on a laptop or a landscape phone.                               |

## Generating your own data

The snapshot is enough to explore. To build training data from scratch in your own Mubit workspace, delete `data/store.json` and `demo/store.json`, then play the reviewer over synthetic claims:

```bash
curl -X POST localhost:3000/api/seed -H 'content-type: application/json' -d '{"n": 20}'
curl -X POST localhost:3000/api/eval   # the held-out evaluation, also on the Learning loop page
```

Both make real model calls, so they use Mubit credit.

## Code map

| File                                |                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `lib/prompt.ts`                     | The frozen system prompt, the user-message layout and the verdict schema |
| `lib/mubit.ts`                      | The Mubit client, record modes and readable error messages               |
| `lib/verdict.ts`                    | One model call, and a cap of 6 calls in flight across the app            |
| `lib/decide.ts`                     | First pass, approve, override, and the verified commit                   |
| `lib/precedents.ts`                 | Tagging claims and matching precedents to them                           |
| `lib/refresh.ts`                    | Policy versions, re-checking open claims, retiring precedents            |
| `lib/generate.ts`                   | Synthetic claims with known answers, for seeding and evaluation          |
| `lib/eval.ts`                       | The held-out evaluation                                                  |
| `lib/game.ts`                       | Night Shift: per-shift rulings, the two rounds and the 09:00 audit       |
| `lib/encounters.ts`, `lib/audit.ts` | The game's claims, and the six unseen audit claims with their answers    |
| `lib/store.ts`                      | The JSON store, starting from `demo/store.json`                          |
| `app/play/night-shift.tsx`          | The game scene                                                           |

Next.js 16 (App Router, Cache Components), React 19, Tailwind v4, shadcn/ui (Base UI). Checks: `npm run lint` and `npm run build`.

Built by Plamen Dochev.
