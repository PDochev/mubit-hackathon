import { ArrowUpRight, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Suspense } from "react";
import { runEvaluation } from "@/app/actions";
import {
  Cell,
  CellGrid,
  FigCaption,
  HatchBand,
  MonoLabel,
  PageHeader,
  rise,
  SectionHeader,
  StatCell,
  VerdictBadge,
} from "@/components/app-ui";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { publicUrl } from "@/lib/lan";
import { readStore } from "@/lib/store";
import type { ClaimRecord, EvalComparison } from "@/lib/types";

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
        <Link href={MUBIT_CONSOLE} target="_blank" className={buttonVariants({ variant: "outline" })}>
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

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

function accuracy(claims: ClaimRecord[]) {
  const scored = claims.filter((c) => c.expected && c.firstPass);
  return { n: scored.length, right: scored.filter((c) => c.firstPass!.verdict === c.expected!.verdict).length };
}

async function Loop() {
  await connection();
  const { claims, precedents, evals } = await readStore();
  const committed = claims.filter((c) => c.commit);
  const verified = committed.filter((c) => c.commit!.status === "verified");
  const overrides = claims.filter((c) => c.final && c.firstPass && c.final.verdict !== c.firstPass.verdict);

  // House-rule claims are the ones only a correction can fix. Compare the
  // model's first pass before any matching precedent existed and after.
  const ruleOf = (precedentId: string) =>
    claims.find((c) => c.id === precedents.find((p) => p.id === precedentId)?.claimId)?.expected?.houseRule;
  const hadRuling = (c: ClaimRecord) =>
    c.firstPass?.precedentIds.some((id) => ruleOf(id) === c.expected?.houseRule) ?? false;
  const houseRule = claims.filter((c) => c.expected?.houseRule);
  const before = accuracy(houseRule.filter((c) => !hadRuling(c)));
  const after = accuracy(houseRule.filter(hadRuling));

  const submitUrl = `${publicUrl()}/submit`;
  const qr = await QRCode.toDataURL(submitUrl, { margin: 1, width: 240, color: { dark: "#09090b", light: "#ffffff" } });
  const run = evals.at(-1);

  return (
    <>
      <SectionHeader title="Held-out evaluation">
        <div className="flex items-center gap-3">
          {run && (
            <MonoLabel className="hidden sm:inline">
              run {evals.length} · {run.precedentCount} precedents ·{" "}
              {new Date(run.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
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
          <Comparison index={1} result={run.houseRule} title="House-rule cases" />
          <Cell className="py-4 md:col-span-2">
            <FigCaption n={1}>
              Verdict accuracy on {run.n} claims the model has never seen, with the written policy alone and with the
              finance team&apos;s precedents. House-rule cases are the ones only a correction can fix.
            </FigCaption>
          </Cell>
        </CellGrid>
      ) : (
        <Cell className="screen-line-bottom text-muted-foreground">No evaluation yet. Run one to measure what the rulings are worth.</Cell>
      )}

      <HatchBand />

      <CellGrid className="sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          index={0}
          label="training examples sent"
          value={verified.length}
          hint={
            <div className="flex flex-col gap-2">
              <Progress value={Math.min(100, (verified.length / FIRST_TRAINING_AT) * 100)} />
              {verified.length >= FIRST_TRAINING_AT ? "Enough for Mubit to train" : `${FIRST_TRAINING_AT} needed for the first training`}
            </div>
          }
        />
        <StatCell index={1} label="corrections" value={overrides.length} hint="Overrides with a written ruling" />
        <StatCell index={2} label="precedents" value={precedents.length} hint="Applied to every matching claim" />
        <StatCell
          index={3}
          label="house rules, first time"
          value={`${pct(before.right, before.n)} → ${pct(after.right, after.n)}`}
          hint={`Live claims before vs after a precedent (${before.n} / ${after.n})`}
        />
      </CellGrid>

      <HatchBand />

      <CellGrid className="lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 bg-background">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-4 py-6 sm:px-8">
            <h2 className="text-lg font-semibold tracking-tight">Recorded examples</h2>
            <span className="text-sm text-muted-foreground">Only human-checked verdicts train the model</span>
          </div>
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
              {[...committed].reverse().slice(0, 10).map((c) => (
                <TableRow key={c.id} className="h-14">
                  <TableCell>
                    <Link href={`/?filter=all&claim=${c.id}`} className="group flex flex-col">
                      <span className="group-hover:underline">{c.merchant}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{c.final && <VerdictBadge verdict={c.final.verdict} />}</TableCell>
                  <TableCell>
                    {c.final && c.final.verdict !== c.firstPass?.verdict ? (
                      <span className="font-medium">Corrected{c.final.precedentId ? ` → ${c.final.precedentId}` : ""}</span>
                    ) : (
                      <span className="text-muted-foreground">Confirmed</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className={c.commit!.status === "verified" ? "text-muted-foreground" : "text-destructive"}>
                      {c.commit!.mubitRequestId ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Cell className="relative flex flex-col items-center gap-4">
          <div className="flex w-full items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Try it</h2>
            <MonoLabel>from your phone</MonoLabel>
          </div>
          <p className="-rotate-3 self-start font-hand text-xl text-muted-foreground">scan me, submit an expense ↓</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR code */}
          <img src={qr} alt={`QR code for ${submitUrl}`} className="rounded-xl p-2 ring-1 ring-border" width={220} height={220} />
          <MonoLabel>{submitUrl}</MonoLabel>
        </Cell>
      </CellGrid>
    </>
  );
}

function Comparison({ title, result, index }: { title: string; result: EvalComparison; index: number }) {
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
          <span className="text-6xl font-semibold tracking-tighter tabular-nums sm:text-7xl">{after}%</span>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { label: "policy only", value: before },
            { label: "policy + precedents", value: after },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <MonoLabel>{label}</MonoLabel>
                <MonoLabel className="text-foreground tabular-nums">{value}%</MonoLabel>
              </div>
              <Progress value={value} />
            </div>
          ))}
        </div>
      </div>
    </Cell>
  );
}

