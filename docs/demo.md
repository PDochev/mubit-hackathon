# Precedent: demo plan

Mubit Night Shift hackathon, London. Code freeze Sun 25 Oct 10:00. Judging round 1 at 10:30, finalist demos at 12:30.

## What the app is

**Precedent learns your finance team's unwritten rules.**

An employee submits an expense. The model checks it against the company policy and gives a verdict (approve, violation or needs info) citing the clause it relied on. When finance disagrees, they override it and write one sentence explaining why. That sentence does two things:

1. **It applies straight away (the instant fix).** It's saved as a precedent and sent with every similar claim, so the next one gets it right.
2. **It becomes training data (the permanent fix).** The corrected call is recorded through Mubit as a verified training example, and Mubit trains a small open model (Qwen3-4B) on those examples.

**The problem it solves:** written policies never cover everything. Is a freelancer at a team dinner "team" or "client"? Is a taxi at 20:30 after a client dinner allowed when the policy says "after 21:00"? Finance answers these every week, and the answers live in people's heads.

**Night Shift (`/play`)** is the same loop as a game: you train an AI apprentice overnight, then watch it face a 09:00 audit of claims it has never seen.

## Track

**Enter: Recurring tasks.** Expense review is the textbook recurring task, and the demo shows corrections becoming model updates.

Mention the other two as bonuses:
- **Own your intelligence layer:** the adapter is 4.2× faster than the provider model with 3.7× fewer tokens, and scores 0% → 69% on Mubit's exam.
- **Fast refresh:** editing the policy re-checks every open claim and tests each precedent against the new text.

## What will have the most impact

The judges are looking for one moment: **a correction visibly changing the model's behaviour.**

Your strongest version is **round 2 of Night Shift**. On a claim you never showed it, the robot says **"USING R1 · I'D REJECT"**, because of a sentence you taught it two minutes earlier.

Then prove it's a real model update: follow the ruling's `mreq_` ID into the **Mubit console**, and show what the adapter learned from rulings like it. That's what separates Precedent from "just prompt stuffing".

**The two-speed story:** the precedent is the instant fix; the recorded example and the adapter are the permanent fix. Never imply the model's weights changed between round 1 and round 2.

### Numbers to use

| Claim | Number |
|---|---|
| Held-out eval, all claims (50 unseen) | 74% → **90%** |
| Held-out eval, house-rule cases | 0% → **100%** (0 of 9 → 9 of 9) |
| Training data | 350 verified examples (38 from Night Shift), 32 of them corrections |
| Adapter v1, Mubit's exam | 0% → **69%** |
| Adapter v1, silent test | 15 of 21 pairs as good as the provider (71%). Refresh from the console before the demo. |
| Adapter v1, contractor claim | **4.2× faster** (579 ms vs 2.43 s), **3.7× fewer tokens** (41 vs 150) |
| Night Shift test run | audit **3/6 → 5/6**, 7/7 rulings verified |

## 3-minute video script (aim for 2:45)

| Time | Show | Say (roughly) | Criterion |
|---|---|---|---|
| 0:00–0:15 | Inbox | "Expense policies never cover everything. Is a freelancer at a team dinner 'team' or 'client'? Finance answers that every week, and the answer lives in someone's head." | Usefulness |
| 0:15–0:35 | Submit a claim, then its verdict in the inbox citing the clause | "Every claim is checked against the policy in seconds, through Mubit." | Usefulness |
| 0:35–1:10 | **Night Shift.** Priya's dinner → robot says NEED INFO → stamp REJECT, pick the contractor reason → "+1 RULING · R1 LEARNED · recorded mreq_…" | "Here I'm finance. It's unsure, I correct it with one sentence. That becomes a rule now, and a training example in Mubit." | **Use of Mubit** |
| 1:10–1:20 | Rosa's taxi: teach R2 (cut the two quick agrees) | "Second correction." | |
| 1:20–1:40 | **03:00, round 2.** Priya's lunch → **"USING R1 · I'D REJECT"** | "New claim, new details. It applies my ruling with no help." **Pause and let it land.** | **Use of Mubit** |
| 1:40–2:00 | 09:00 audit: stamps land, **3/6 → 5/6** | "Six claims it has never seen: before my rulings and after." | Technical |
| 2:00–2:35 | Shift report → Learning loop → **Mubit console, the same `mreq_` ID** → adapter evidence | "That ruling is now a verified example in Mubit. Here's what the last version learned from rulings exactly like it: the open model answers the contractor claim the way finance does, cites the precedent itself, 4.2× faster, with 3.7× fewer tokens. Every ruling feeds the next version." | **Use of Mubit**, Own intelligence |
| 2:35–2:50 | Learning loop: held-out eval | "On 50 unseen claims, the cases only a correction can fix go from 0% to 100%, and all claims from 74% to 90%." | Technical |
| 2:50–3:00 | Back to the inbox | "Every ruling becomes a model update. That's Precedent." | |

## Preparation checklist

### Tonight
- [ ] Full practice run of Night Shift (~25 model calls).
- [ ] Copy `data/store.json` to `data/store.demo.json` as a restore point.
- [ ] Rehearse the reason cards: Priya → contractor (REJECT), Rosa → late taxi (APPROVE), Sam → client coffee (APPROVE). If the robot gets a claim right first time, just agree; round 2 still works off the rulings you did teach. Rosa is the most reliable miss.
- [ ] Record the video in short takes. Cut the 2–3 s model waits and the two "agree" claims (Mei, Gerald).
- [ ] Mubit console open in a logged-in tab, on the Requests list, ready to search an `mreq_` ID.
- [ ] Browser: full screen, bookmarks bar hidden, 1440×900, no other tabs visible.
- [ ] Refresh the silent-test numbers (pairs, agreement, lower bound) from the console into `lib/adapter-evidence.ts`.
- [ ] Record the fallback video for the live demo.

### Sunday
- [ ] One more rehearsal, timed: under 3:00.
- [ ] **Before 10:00: commit and push.** Most of the recent work is uncommitted.
- [ ] Live finalist demo: phone hotspot as backup to the venue Wi-Fi, fallback video ready, `store.demo.json` to restore.

## Questions to have answers ready for

**"Isn't a precedent just stuffing the prompt?"**
Yes, deliberately: it's the instant fix. The permanent fix is the recorded example that trains the adapter. Precedents can be retired once the policy or the model covers them.

**"When does a ruling actually reach the model?"**
It's in Mubit's training set as soon as it's verified. Mubit retrains on its own schedule (it can't be triggered manually yet), and v1 shows what that produces.

**"How do you stop it training on its own mistakes?"**
First passes are recorded as metadata only, so they never train. Only the call made after a human verdict is fully recorded, and it only counts if the reply matches the human's verdict (one retry, otherwise marked unverified).

**"Is the adapter serving traffic?"**
Not yet. Mubit hasn't rolled out dedicated endpoints. Until then it runs a silent test: 10% of live requests also go to the adapter and each pair is graded. Those are the numbers we show, labelled as from the Mubit console.

**"Why only 5/6 on the audit?"**
The coffee ruling says "client", and the robot didn't stretch it to a prospect. A precedent only covers what it says, which is the honest behaviour you want from a compliance tool.

**"Is the evaluation just memorisation?"**
No. The 50 held-out claims use people, merchants and wording that never appear in training.

**"What about prompt injection in a claim?"**
Auto-approval never trusts the model alone: the amount and receipt checks are deterministic code. Claim text is length-limited.

**"What if finance makes a wrong ruling?"**
Retire the precedent on the Policy page. Editing the policy re-checks every open claim and tests each precedent against the new text.

**"Why is this useful beyond expenses?"**
Any review task with a written rulebook and unwritten exceptions: procurement, refunds, content moderation, compliance checks. The loop is the same.
