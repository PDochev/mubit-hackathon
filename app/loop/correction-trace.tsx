import { Route } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MonoLabel, PrecedentId, VerdictBadge } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADAPTER_EVIDENCE } from "@/lib/adapter-evidence";
import { londonTime, money, ruling } from "@/lib/status";
import type { ClaimRecord, Precedent } from "@/lib/types";
import { cn } from "@/lib/utils";

type StepState = "done" | "pending" | "skipped";

type Step = {
  title: string;
  at?: string;
  state: StepState;
  body: ReactNode;
};

// Follows one finance correction from the override to the trained model:
// override → precedent → verified training examples → adapter versions.
// Steps up to the examples come from our own records; the adapter steps
// come from ADAPTER_EVIDENCE, copied from the Mubit console.
export function CorrectionTrace({
  claims,
  precedents,
}: {
  claims: ClaimRecord[];
  precedents: Precedent[];
}) {
  if (precedents.length === 0) return null;
  const e = ADAPTER_EVIDENCE;
  // Open on the ruling the adapter evidence shows a pair for.
  const first =
    precedents.find((p) => p.id === e.pair.adapter.clause) ??
    precedents.at(-1)!;

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Route data-icon="inline-start" />
        Trace a correction
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trace a correction</DialogTitle>
          <DialogDescription>
            From one finance override to the open model Mubit trains. P2, P4…
            are precedents: rulings the model cites like policy sections.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={first.id}>
          <TabsList>
            {precedents.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                <PrecedentId id={p.id} />
                {p.createdAt > e.trainingStartedAt && (
                  <span className="text-xs text-muted-foreground">
                    after {e.version}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {precedents.map((p) => (
            <TabsContent key={p.id} value={p.id} className="pt-3">
              <ol className="flex flex-col">
                {traceSteps(p, claims).map((step, i, steps) => (
                  <TraceStep
                    key={step.title}
                    step={step}
                    n={i + 1}
                    last={i === steps.length - 1}
                  />
                ))}
              </ol>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function traceSteps(p: Precedent, claims: ClaimRecord[]): Step[] {
  const e = ADAPTER_EVIDENCE;
  const source = claims.find((c) => c.id === p.claimId);
  const followed = claims.filter(
    (c) => c.id !== p.claimId && c.firstPass?.precedentIds.includes(p.id),
  );
  // Recorded examples that carry this ruling: the corrected claim itself,
  // plus every later claim answered with the precedent in its prompt.
  const examples = claims
    .filter(
      (c) =>
        c.commit?.status === "verified" &&
        (c.id === p.claimId || c.firstPass?.precedentIds.includes(p.id)),
    )
    .sort((a, b) => a.commit!.at.localeCompare(b.commit!.at));
  const beforeTraining = examples.filter(
    (c) => c.commit!.at < e.trainingStartedAt,
  ).length;
  const sinceTraining = examples.length - beforeTraining;
  const pairClaim =
    e.pair.adapter.clause === p.id
      ? claims.find((c) => c.id === e.pair.claimId)
      : undefined;

  return [
    {
      title: "Finance overrides the model",
      at: p.createdAt,
      state: "done",
      body: (
        <>
          {source && (
            <Link
              href={`/?filter=all&claim=${source.id}`}
              className="flex flex-wrap items-center gap-2 hover:underline"
            >
              <span className="font-mono text-xs">{source.id}</span>
              {source.merchant} · {money(source.amount)}
            </Link>
          )}
          {source?.firstPass && (
            <div className="flex flex-wrap items-center gap-2">
              The model said
              <VerdictBadge verdict={source.firstPass.verdict} />
              finance ruled
              <VerdictBadge verdict={p.verdict} />
            </div>
          )}
          <p className="text-foreground">&ldquo;{ruling(p.reason)}&rdquo;</p>
        </>
      ),
    },
    {
      title: `It becomes precedent ${p.id}`,
      at: p.createdAt,
      state: p.retiredAt ? "skipped" : "done",
      body: p.retiredAt ? (
        <p>Retired {londonTime(p.retiredAt)}: no longer sent to the model.</p>
      ) : (
        <p>
          Sent with every matching claim from then on. Followed on{" "}
          <Strong>{followed.length}</Strong> claims since.
        </p>
      ),
    },
    {
      title: "Recorded as verified training examples",
      at: examples[0]?.commit!.at,
      state: examples.length ? "done" : "pending",
      body: (
        <>
          <p>
            <Strong>{examples.length}</Strong> calls recorded through Mubit with
            finance&apos;s answer, each re-run checked against the human verdict
            before it counts.
          </p>
          {examples[0]?.commit!.mubitRequestId && (
            <MonoLabel>first: {examples[0].commit!.mubitRequestId}</MonoLabel>
          )}
        </>
      ),
    },
    {
      title: `Adapter ${e.version} trains on them`,
      // A ruling that came after training started has no time on this step.
      at: beforeTraining ? e.trainingStartedAt : undefined,
      state: beforeTraining ? "done" : "skipped",
      body: beforeTraining ? (
        <>
          <p>
            <Strong>{beforeTraining}</Strong> of these examples were recorded
            before {e.version} started training on {e.base}.
          </p>
          {pairClaim && (
            <p>
              On a silent-test copy of{" "}
              <Link
                href={`/?filter=all&claim=${pairClaim.id}`}
                className="font-mono text-xs hover:underline"
              >
                {pairClaim.id}
              </Link>
              {pairClaim.createdAt > e.trainingStartedAt &&
                ", a claim created after training"}
              , {e.version} cites <PrecedentId id={p.id} /> itself:{" "}
              {e.pair.adapter.verdict} in{" "}
              <Strong>{e.pair.adapter.latencyMs} ms</Strong> (the provider took{" "}
              {(e.pair.provider.latencyMs / 1000).toFixed(2)} s).
            </p>
          )}
        </>
      ) : (
        <p>
          This ruling came after {e.version} started training, so {e.version}{" "}
          never saw it.
        </p>
      ),
    },
    {
      title: "Next version",
      state: "pending",
      body: (
        <p>
          <Strong>{sinceTraining}</Strong> examples of this ruling recorded
          since {e.version} are waiting for the next training. Mubit trains a
          new version once enough new examples arrive.
        </p>
      ),
    },
  ];
}

function TraceStep({
  step,
  n,
  last,
}: {
  step: Step;
  n: number;
  last: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute top-7 bottom-0 left-3.5 w-px -translate-x-1/2",
            step.state === "done" ? "bg-learn/40" : "bg-line",
          )}
        />
      )}
      <span
        className={cn(
          "relative grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs",
          step.state === "done" && "bg-learn text-white",
          step.state === "pending" &&
            "border border-dashed border-muted-foreground/50 bg-background text-muted-foreground",
          step.state === "skipped" &&
            "bg-muted text-muted-foreground line-through",
        )}
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span
            className={cn(
              "font-medium",
              step.state !== "done" && "text-muted-foreground",
            )}
          >
            {step.title}
          </span>
          <MonoLabel>
            {step.at
              ? londonTime(step.at)
              : step.state === "pending"
                ? "waiting"
                : ""}
          </MonoLabel>
        </div>
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {step.body}
        </div>
      </div>
    </li>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}
