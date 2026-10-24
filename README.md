# Precedent

**An expense-policy reviewer that learns from every finance correction.** Built at the Mubit Night Shift hackathon (London, 23–25 Oct 2026).

An employee submits an expense. The model checks it against the company policy and gives a verdict (approve, violation or needs info) with the clause it relied on. When finance disagrees, they override it and write one sentence explaining why. That sentence does two things:

1. **It applies straight away.** It's saved as a *precedent* (P1, P2, …) and sent with every similar claim from then on, so the very next claim gets it right.
2. **It becomes a model update.** The corrected call is recorded through Mubit as a verified training example, and Mubit trains a small open model on those examples.

## Why

Written expense policies never cover everything. Is a freelancer at a team dinner "team" or "client"? Is a taxi at 20:30 after a client dinner allowed when the policy says "after 21:00"? Finance answers these questions every week, but the answers live in people's heads. Precedent turns each answer into something the model follows immediately and learns from permanently.

## How it works

```
submit ─▶ model verdict ─▶ finance confirms ──────────────▶ verified example ─▶ Mubit trains adapter
                            └─ or overrides + reason ─▶ precedent ─┘
                                                         └─▶ sent with every matching claim
```

| Step | What happens | Mubit recording |
|---|---|---|
| First pass | System prompt + policy + matching precedents + claim, JSON verdict back. Small, receipted, confident approvals (≤ £100, ≥ 85%) are auto-approved; everything else waits for finance. | `metadata` (never trains) |
| Finance decides | Confirm, or override with a reason. An override becomes a precedent, with tags used to match it to future claims. | — |
| Commit | The claim is asked again with the ruling included and **full recording**. It only counts as a *verified* example if the reply matches finance's verdict (one retry otherwise). | `full` (trains) |
| Policy edit | Saving a new policy version re-checks every open claim and tests each precedent against the new text. A precedent the policy now covers can be retired. | `metadata` |
| Evaluation | 50 unseen claims (new people, merchants and wording), each asked with the policy alone and with the precedents. | `metadata` |

## How it uses Mubit

- **Every LLM call goes through Mubit**, via its OpenAI-compatible endpoint (`https://api.mubit.ai/openai/v1`, model `gpt-6-luna`). See `lib/mubit.ts`.
- **One frozen system prompt = one Mubit task.** Mubit groups calls by instructions and output format, so the system prompt and message layout in `lib/prompt.ts` are frozen. Everything that varies (policy, precedents, claim) goes in the user message.
- **Only human-checked answers train.** The `x-middleware-record` header is set per call: `metadata` for anything nobody has checked yet (first passes, re-checks, evaluations), `full` only for the commit after finance has decided, and only kept when the reply agrees with finance.
- **Every training example is traceable.** Each commit stores Mubit's request ID (`mreq_…`), shown in the inbox and on the Learning loop page.
- **Mubit trains the adapter.** From these examples Mubit trained adapter v1 on Qwen3-4B, which is now in a 10% shadow test against the provider model.

## Night Shift: the demo game

`/play` turns the same loop into a two-minute game. You're on the night shift at Northwind, training an AI apprentice that knows the written policy and nothing else.

1. **23:00, round 1.** Four coworkers bring claims. The apprentice stamps each one (approve, reject or needs info, with the clause). Agree with it, or stamp your own verdict and pick the one-sentence reason. Each disagreement becomes a *ruling* (R1, R2, …) for the rest of the night.
2. **03:00, round 2.** The same kinds of cases come back with new details. The apprentice now applies your rulings unprompted ("USING R1 · I'D REJECT").
3. **09:00 audit.** Six claims it has never seen, each asked twice: with no rulings (as it started the night) and with yours. The board shows both against the right answer.
4. **Shift report.** Agreement in round 1 vs round 2, the audit before → after, and the Mubit request ID of every recorded ruling. The Learning loop page shows the latest audited shift too.

It runs on the same engine as the inbox (`lib/game.ts`): first passes are `metadata`, and every ruling is committed with `full` recording and verified like an inbox correction, so a game is real training data. In our test run the apprentice got both round-2 repeats right on its own, the audit went from **3/6 to 5/6**, and all 7 rulings were recorded and verified. A full night is about 25 model calls.

## Results

**Instant fix: precedents** (held-out evaluation, 50 claims written with people, merchants and wording that never appear in training):

| | Policy only | Policy + precedents |
|---|---|---|
| All claims | 76% | **88%** |
| House-rule cases (only a correction can fix these) | 11% | **100%** |

**Permanent fix: the trained adapter** (Mubit adapter v1, Qwen3-4B, trained on our verified examples):

| | |
|---|---|
| Mubit's held-out exam | base model 0% → adapter **69%** |
| Live shadow test | 15 of 21 replies judged as good as the provider's (71%) |
| Contractor dinner claim | Same verdict as GPT, and it cites precedent P2 by itself, **4.2× faster** (579 ms vs 2.43 s) with **3.7× fewer tokens** |

Training data so far: 312 verified examples, 32 of them corrections.

Mubit's API doesn't expose adapter results, so the adapter figures are copied from the Mubit console into `lib/adapter-evidence.ts` and labelled as such in the app.

## The app

| Page | |
|---|---|
| **Inbox** `/` | Claims with the model's verdict. Open one to confirm or override it. |
| **Submit** `/submit` | The employee form, with four example claims the policy is unclear about. |
| **Policy** `/policy` | Edit the policy and see open claims re-checked, with a diff of what changed. Precedents and whether the policy now covers them. |
| **Learning loop** `/loop` | The evaluation, the adapter evidence, a step-by-step trace of one correction into the model, the latest Night Shift, and the recorded examples. |
| **Night Shift** `/play` | The demo game: train the apprentice overnight, then watch the 09:00 audit. Best on a laptop or a landscape phone. |

## Run it

Requires Node 24 and a Mubit API key.

```bash
npm install
echo "MUBIT_API_KEY=your-key" > .env.local
npm run dev            # http://localhost:3000
```

Data lives in `data/store.json` (created on first use, not committed). To generate claims and training examples, play the reviewer over synthetic claims:

```bash
curl -X POST localhost:3000/api/seed -H 'content-type: application/json' -d '{"n": 20}'
curl -X POST localhost:3000/api/eval   # the held-out evaluation, also on the Learning loop page
```

Both make real model calls, so they use Mubit credit.

## Code map

| File | |
|---|---|
| `lib/prompt.ts` | The frozen system prompt, the user-message layout and the verdict schema |
| `lib/mubit.ts` | The Mubit client, record modes and readable error messages |
| `lib/verdict.ts` | One model call, and a cap of 6 calls in flight across the app |
| `lib/decide.ts` | First pass, approve, override, and the verified commit |
| `lib/precedents.ts` | Tagging claims and matching precedents to them |
| `lib/refresh.ts` | Policy versions, re-checking open claims, retiring precedents |
| `lib/generate.ts` | Synthetic claims with known answers, for seeding and evaluation |
| `lib/eval.ts` | The held-out evaluation |
| `lib/game.ts` | Night Shift: per-shift rulings, the two rounds and the 09:00 audit |
| `lib/encounters.ts`, `lib/audit.ts` | The game's claims, and the six unseen audit claims with their answers |
| `app/play/night-shift.tsx` | The game scene |

Next.js 16 (App Router, Cache Components), React 19, Tailwind v4, shadcn/ui (Base UI).

## Limitations

- **Demo-grade access control.** Finance actions only work from `localhost` (`lib/reviewer.ts`); there is no login. Anyone who can reach the app can play Night Shift, which uses model calls.
- **A JSON file as the database**, fine for a demo, not for concurrent users at scale.
- **Synthetic training data.** Seeded claims are generated from templates with known answers; the evaluation uses separate templates and vocabulary so it measures generalisation, not recall.
- **The adapter can't be called from the app.** Mubit serves it in shadow mode only, so the side-by-side comparison comes from Mubit's own silent-test pairs.
