import { ArrowRight, ArrowUpRight, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { runEvaluation } from "@/app/actions";
import {
  BeforeAfter,
  Cell,
  CellGrid,
  FigCaption,
  HatchBand,
  MonoLabel,
  PageHeader,
  PrecedentId,
  rise,
  SectionHeader,
  StatCell,
  VerdictBadge,
} from "@/components/app-ui";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ADAPTER_EVIDENCE,
  ADAPTER_STAGES,
  type AdapterStage,
  type PairReply,
} from "@/lib/adapter-evidence";
import { CorrectionTrace } from "./correction-trace";
import { londonTime, money } from "@/lib/status";
import { readStore } from "@/lib/store";
import type { ClaimRecord, EvalComparison, Game, Precedent } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIRST_TRAINING_AT = 25;
const MUBIT_CONSOLE = "https://app.mubit.ai/console";

export default function Page() {
  return (
    <>
      <PageHeader
        icon={RefreshCcw}
        eyebrow="Learning loop"
        title="Every ruling"
        subtitle="becomes a model update."
        description="Overrides apply straight away as precedents, and are recorded through Mubit as corrected training examples for a task-adapted open model."
      >
        <Link
          href={MUBIT_CONSOLE}
          target="_blank"
          className={buttonVariants({ variant: "outline" })}
        >
          Mubit console
          <ArrowUpRight data-icon="inline-end" />
        </Link>
      </PageHeader>
      <Suspense fallback={<Skeleton className="m-8 h-[600px]" />}>
        <Loop />
      </Suspense>
    </>
  );
}

const pct = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 100)}%` : "—";

function accuracy(claims: ClaimRecord[]) {
  const scored = claims.filter((c) => c.expected && c.firstPass);
  return {
    n: scored.length,
    right: scored.filter((c) => c.firstPass!.verdict === c.expected!.verdict)
      .length,
  };
}

async function Loop() {
  await connection();
  const { claims, precedents, evals, games = [] } = await readStore();
  const committed = claims.filter((c) => c.commit);
  const verified = committed.filter((c) => c.commit!.status === "verified");
  // Night Shift rulings are recorded the same way, so they count too.
  const gameVerified = games
    .flatMap((g) => g.claims)
    .filter((c) => c.commit?.status === "verified").length;
  const sent = verified.length + gameVerified;
  const corrected = committed.filter(
    (c) => c.final && c.final.verdict !== c.firstPass?.verdict,
  );
  const overrides = claims.filter(
    (c) => c.final && c.firstPass && c.final.verdict !== c.firstPass.verdict,
  );

  // House-rule claims are the ones only a correction can fix. Compare the
  // model's first pass before any matching precedent existed and after.
  const ruleOf = (precedentId: string) =>
    claims.find(
      (c) => c.id === precedents.find((p) => p.id === precedentId)?.claimId,
    )?.expected?.houseRule;
  const hadRuling = (c: ClaimRecord) =>
    c.firstPass?.precedentIds.some(
      (id) => ruleOf(id) === c.expected?.houseRule,
    ) ?? false;
  const houseRule = claims.filter((c) => c.expected?.houseRule);
  const before = accuracy(houseRule.filter((c) => !hadRuling(c)));
  const after = accuracy(houseRule.filter(hadRuling));

  const run = evals.at(-1);

  return (
    <>
      <CellGrid className="sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          index={0}
          label="training examples sent"
          value={sent}
          hint={
            <div className="flex flex-col gap-2">
              <Progress
                value={Math.min(100, (sent / FIRST_TRAINING_AT) * 100)}
              />
              {sent >= FIRST_TRAINING_AT
                ? "Enough for Mubit to train"
                : `${FIRST_TRAINING_AT} needed for the first training`}
              {gameVerified > 0 && (
                <span>{gameVerified} from Night Shift</span>
              )}
            </div>
          }
        />
        <StatCell
          index={1}
          label="corrections"
          value={overrides.length}
          hint="Overrides with a written ruling"
        />
        <StatCell
          index={2}
          label="precedents"
          value={precedents.length}
          hint="Applied to every matching claim"
        />
        <StatCell
          index={3}
          label="house rules, live claims"
          value={
            <BeforeAfter
              before={pct(before.right, before.n)}
              after={pct(after.right, after.n)}
            />
          }
          hint={`Right first time on real traffic, before vs after a matching precedent existed (${before.n} / ${after.n} claims)`}
        />
      </CellGrid>

      <HatchBand />

      <SectionHeader title="Held-out evaluation">
        <div className="flex items-center gap-3">
          {run && (
            <MonoLabel className="hidden sm:inline">
              run {evals.length} · {run.precedentCount} precedents ·{" "}
              {new Date(run.at).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </MonoLabel>
          )}
          <form action={runEvaluation}>
            <SubmitButton pending="Evaluating…" size="sm">
              Run evaluation
            </SubmitButton>
          </form>
        </div>
      </SectionHeader>
      {run ? (
        <CellGrid className="md:grid-cols-2">
          <Comparison index={0} result={run.all} title="All claim types" />
          <Comparison
            index={1}
            result={run.houseRule}
            title="House-rule cases"
          />
          <Cell className="py-4 md:col-span-2">
            <FigCaption n={1}>
              Verdict accuracy on {run.n} claims the model has never seen
              {run.set === 4
                ? ", written with people, merchants and wording that never appear in training"
                : ""}
              , with the written policy alone and with the finance team&apos;s
              precedents. House-rule cases are the ones only a correction can
              fix.
            </FigCaption>
          </Cell>
        </CellGrid>
      ) : (
        <Cell className="screen-line-bottom text-muted-foreground">
          No evaluation yet. Run one to measure what the rulings are worth.
        </Cell>
      )}

      <HatchBand />

      <AdapterEvidence claims={claims} precedents={precedents} />

      <HatchBand />

      <NightShift games={games} />

      <CellGrid>
        <Tabs defaultValue="latest" className="min-w-0 gap-0 bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-5 sm:px-8">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-semibold tracking-tight">
                Recorded examples
              </h2>
              <span className="text-sm text-muted-foreground">
                Only human-checked verdicts train the model
              </span>
            </div>
            <TabsList>
              <TabsTrigger value="latest">Latest</TabsTrigger>
              <TabsTrigger value="corrected">
                Corrections
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {corrected.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="latest">
            <ExampleTable claims={committed.toReversed().slice(0, 10)} />
          </TabsContent>
          <TabsContent value="corrected">
            <ExampleTable claims={corrected.toReversed().slice(0, 10)} />
          </TabsContent>
        </Tabs>
      </CellGrid>
    </>
  );
}

// The Night Shift audited most recently (or, failing that, the latest one
// with a recorded ruling), so the game's shift report continues here.
function NightShift({ games }: { games: Game[] }) {
  const game =
    games
      .filter((g) => g.audit)
      .toSorted((a, b) => a.audit!.at.localeCompare(b.audit!.at))
      .at(-1) ?? games.findLast((g) => g.claims.some((c) => c.commit));
  if (!game) return null;
  const recorded = game.claims.filter((c) => c.commit);
  const verified = recorded.filter((c) => c.commit!.status === "verified");
  const ruled = game.claims.filter((c) => c.final && c.firstPass);
  const agreed = ruled.filter((c) => c.final!.verdict === c.firstPass!.verdict);
  const right = (key: "untrained" | "trained") =>
    game.audit?.results.filter((r) => r[key].verdict === r.expected).length ?? 0;

  return (
    <>
      <SectionHeader title="Night Shift">
        <div className="flex items-center gap-3">
          <MonoLabel className="hidden sm:inline">
            {game.audit ? "audited" : "started"} ·{" "}
            {londonTime(game.audit?.at ?? game.createdAt, { hour: "2-digit", minute: "2-digit" })}
          </MonoLabel>
          <Link href="/play" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Play
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </SectionHeader>
      <CellGrid className="sm:grid-cols-3">
        <StatCell
          index={0}
          label="09:00 audit"
          value={
            game.audit ? (
              <BeforeAfter
                before={`${right("untrained")}/${game.audit.results.length}`}
                after={`${right("trained")}/${game.audit.results.length}`}
              />
            ) : (
              "—"
            )
          }
          hint="Unseen claims, before vs after the night's rulings"
        />
        <StatCell
          index={1}
          label="rulings"
          value={game.precedents.length}
          hint="Corrections the player wrote, applied for the rest of the night"
        />
        <StatCell
          index={2}
          label="recorded through mubit"
          value={`${verified.length}/${recorded.length}`}
          hint={`Verified training examples · agreed with the player on ${agreed.length} of ${ruled.length}`}
        />
      </CellGrid>
      {game.precedents.length > 0 && (
        <Cell className="flex flex-col gap-2 screen-line-bottom">
          {game.precedents.map((p) => {
            const commit = game.claims.find(
              (c) => c.final?.precedentId === p.id,
            )?.commit;
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
              >
                <PrecedentId id={p.id} />
                <VerdictBadge verdict={p.verdict} />
                <span className="min-w-0 flex-1">{p.reason}</span>
                {commit?.mubitRequestId && (
                  <span title={commit.mubitRequestId}>
                    <MonoLabel>{shortId(commit.mubitRequestId)}</MonoLabel>
                  </span>
                )}
              </div>
            );
          })}
        </Cell>
      )}
      <HatchBand />
    </>
  );
}

// Long Mubit request IDs, shortened to their start and end.
const shortId = (id: string) => `${id.slice(0, 13)}…${id.slice(-4)}`;

function ExampleTable({ claims }: { claims: ClaimRecord[] }) {
  return (
    <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4 sm:[&_td:first-child]:pl-8 sm:[&_td:last-child]:pr-8 sm:[&_th:first-child]:pl-8 sm:[&_th:last-child]:pr-8">
      <TableHeader>
        <TableRow>
          <TableHead>Claim</TableHead>
          <TableHead>Decision</TableHead>
          <TableHead>How</TableHead>
          <TableHead>Mubit request</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((c) => (
          <TableRow key={c.id} className="h-14">
            <TableCell>
              <Link
                href={`/?filter=all&claim=${c.id}`}
                className="group flex flex-col"
              >
                <span className="group-hover:underline">{c.merchant}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {c.id}
                </span>
              </Link>
            </TableCell>
            <TableCell>
              {c.final && <VerdictBadge verdict={c.final.verdict} />}
            </TableCell>
            <TableCell>
              {c.final && c.final.verdict !== c.firstPass?.verdict ? (
                <span className="font-medium">
                  Corrected
                  {c.final.precedentId && (
                    <>
                      {" → "}
                      <PrecedentId id={c.final.precedentId} />
                    </>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Confirmed</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">
              <span
                title={c.commit!.mubitRequestId ?? undefined}
                className={
                  c.commit!.status === "verified"
                    ? "text-muted-foreground"
                    : "text-destructive"
                }
              >
                {c.commit!.mubitRequestId
                  ? shortId(c.commit!.mubitRequestId)
                  : "—"}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Comparison({
  title,
  result,
  index,
}: {
  title: string;
  result: EvalComparison;
  index: number;
}) {
  const before = Math.round(result.withoutPrecedents.accuracy * 100);
  const after = Math.round(result.withPrecedents.accuracy * 100);
  return (
    <Cell>
      <div className="rise flex flex-col gap-6" style={rise(index)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{title}</span>
          <MonoLabel>{result.withPrecedents.n} claims</MonoLabel>
        </div>
        <div className="flex items-baseline gap-4 leading-none">
          <span className="text-3xl font-semibold tracking-tighter text-muted-foreground/60 tabular-nums line-through decoration-1">
            {before}%
          </span>
          <span className="text-6xl font-semibold tracking-tighter text-learn tabular-nums sm:text-7xl">
            {after}%
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { label: "policy only", value: before, learned: false },
            { label: "policy + precedents", value: after, learned: true },
          ].map(({ label, value, learned }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <MonoLabel>{label}</MonoLabel>
                <MonoLabel className="text-foreground tabular-nums">
                  {value}%
                </MonoLabel>
              </div>
              <Progress
                value={value}
                className={cn(
                  learned && "[&_[data-slot=progress-indicator]]:bg-learn",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </Cell>
  );
}

const STAGE_LABEL: Record<AdapterStage, string> = {
  trained: `Trained · ${londonTime(ADAPTER_EVIDENCE.trainingStartedAt, { day: "numeric", month: "short" })}`,
  shadow: `Shadow · ${ADAPTER_EVIDENCE.shadowShare * 100}%`,
  canary: "Canary",
  live: "Live",
};

// The permanent fix: the open model Mubit trained on verified corrections.
function AdapterEvidence({
  claims,
  precedents,
}: {
  claims: ClaimRecord[];
  precedents: Precedent[];
}) {
  const e = ADAPTER_EVIDENCE;
  const claim = claims.find((c) => c.id === e.pair.claimId);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const current = ADAPTER_STAGES.indexOf(e.stage);

  return (
    <>
      <SectionHeader title="Adapter evidence">
        <div className="flex items-center gap-3">
          <MonoLabel className="hidden lg:inline">
            {e.version} · {e.base} · from the Mubit console, {e.copiedAt}
          </MonoLabel>
          <Link
            href={e.consoleUrl}
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open adapter
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </div>
      </SectionHeader>

      <CellGrid className="md:grid-cols-2">
        <Cell className="flex flex-wrap items-end justify-between gap-4 md:col-span-2">
          <div className="flex max-w-3xl flex-col gap-2">
            <MonoLabel>same claim, two models · a silent-test copy</MonoLabel>
            {claim && (
              <Link
                href={`/?filter=all&claim=${claim.id}`}
                className="group flex flex-col gap-0.5"
              >
                <span className="font-medium group-hover:underline">
                  {claim.merchant} · {money(claim.amount)} · {claim.headcount}{" "}
                  people
                </span>
                <span className="text-sm text-muted-foreground">
                  {claim.attendees}. {claim.purpose}.
                </span>
              </Link>
            )}
            <p className="text-sm text-muted-foreground">
              Both models get the policy and precedent{" "}
              <PrecedentId id={e.pair.adapter.clause} />, a finance override:
              contractors count as team. The open model, trained only on
              human-verified answers, applies the ruling the way finance does.
            </p>
          </div>
          <CorrectionTrace claims={claims} precedents={precedents} />
        </Cell>
        <PairCell index={0} title="Provider" reply={e.pair.provider} />
        <PairCell
          index={1}
          title="Your adapter"
          reply={e.pair.adapter}
          className="bg-learn-soft"
        />
      </CellGrid>

      <CellGrid className="sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          index={0}
          label="trained on corrections"
          value={
            <BeforeAfter
              before={pct(e.exam.base)}
              after={pct(e.exam.adapter)}
            />
          }
          hint={`Held-out exam, ${e.exam.cases} checks: the base model untrained vs ${e.version}`}
        />
        <StatCell
          index={1}
          label="live agreement"
          value={pct(e.live.passed / e.live.graded)}
          hint={`${e.live.passed} of ${e.live.graded} silent-test pairs judged as good as the provider's reply`}
        />
        <StatCell
          index={2}
          label="faster"
          value={`${(e.pair.provider.latencyMs / e.pair.adapter.latencyMs).toFixed(1)}×`}
          hint={`${e.pair.adapter.latencyMs} ms vs ${(e.pair.provider.latencyMs / 1000).toFixed(2)} s on the claim above`}
        />
        <StatCell
          index={3}
          label="fewer tokens out"
          value={`${(e.pair.provider.tokensOut / e.pair.adapter.tokensOut).toFixed(1)}×`}
          hint={`${e.pair.adapter.tokensOut} vs ${e.pair.provider.tokensOut} on the claim above`}
        />
      </CellGrid>

      <Cell className="flex flex-col gap-4 screen-line-bottom">
        <ol className="flex flex-wrap items-center gap-2">
          {ADAPTER_STAGES.map((stage, i) => (
            <li key={stage} className="flex items-center gap-2">
              {i > 0 && (
                <ArrowRight className="size-3.5 text-muted-foreground" />
              )}
              <span
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-xs ring-1",
                  i === current &&
                    "bg-primary text-primary-foreground ring-primary",
                  i < current && "text-foreground ring-border",
                  i > current && "text-muted-foreground ring-border",
                )}
              >
                {STAGE_LABEL[stage]}
              </span>
            </li>
          ))}
        </ol>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The provider still answers every claim. Mubit sends{" "}
          {pct(e.shadowShare)} of them to the adapter as a silent copy and
          grades each pair; it moves to canary after {e.live.pairsForCanary}{" "}
          graded pairs with a lower bound above {pct(e.live.floor)}. So far:{" "}
          {e.live.graded} pairs, lower bound {pct(e.live.lowerBound)}.
        </p>
      </Cell>
    </>
  );
}

function PairCell({
  title,
  reply,
  index,
  className,
}: {
  title: string;
  reply: PairReply;
  index: number;
  className?: string;
}) {
  return (
    <Cell className={className}>
      <div className="rise flex flex-col gap-4" style={rise(index)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{title}</span>
          <MonoLabel>{reply.model}</MonoLabel>
        </div>
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={reply.verdict} />
          {/^P\d/.test(reply.clause) ? (
            <PrecedentId id={reply.clause} className="text-sm" />
          ) : (
            <span className="font-mono text-sm">{reply.clause}</span>
          )}
        </div>
        <p className="text-sm">&ldquo;{reply.reason}&rdquo;</p>
        <div className="flex gap-8">
          <div className="flex flex-col gap-1">
            <MonoLabel>time</MonoLabel>
            <span className="text-2xl font-semibold tracking-tighter tabular-nums">
              {reply.latencyMs < 1000
                ? `${reply.latencyMs} ms`
                : `${(reply.latencyMs / 1000).toFixed(2)} s`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <MonoLabel>tokens out</MonoLabel>
            <span className="text-2xl font-semibold tracking-tighter tabular-nums">
              {reply.tokensOut}
            </span>
          </div>
        </div>
      </div>
    </Cell>
  );
}
