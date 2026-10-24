import { ArrowRight, BookOpenText, Gavel } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  deletePrecedent,
  recheckOpenClaims,
  reinstatePrecedent,
  retirePrecedent,
  updatePolicy,
} from "@/app/actions";
import {
  Cell,
  CellGrid,
  IconTile,
  MonoLabel,
  PageHeader,
  SectionHeader,
  VERDICT_LABEL,
  VerdictBadge,
} from "@/components/app-ui";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ruling } from "@/lib/status";
import { readStore } from "@/lib/store";
import type { ClaimRecord, Policy, Precedent, Recheck } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <>
      <PageHeader
        icon={BookOpenText}
        eyebrow="Rulebook"
        title="The policy, as written."
        subtitle="And as finance rules it."
        description="Both are sent with every claim, so a change here takes effect on the very next one."
      />
      <Suspense fallback={<Skeleton className="m-8 h-[600px]" />}>
        <PolicyAndPrecedents />
      </Suspense>
    </>
  );
}

async function PolicyAndPrecedents() {
  await connection();
  const {
    policy,
    policyHistory = [],
    precedents,
    claims,
    recheck,
  } = await readStore();
  const previous = policyHistory.at(-1);
  const usage = (id: string) =>
    claims.filter((c) => c.firstPass?.precedentIds.includes(id)).length;
  const active = precedents.filter((p) => !p.retiredAt).length;

  return (
    <>
      {previous && recheck?.policyVersion === policy.version && (
        <Impact
          policy={policy}
          previous={previous}
          recheck={recheck}
          claims={claims}
        />
      )}

      <CellGrid className="lg:grid-cols-2">
        <Cell className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Expense policy
            </h2>
            <MonoLabel>
              v{policy.version} ·{" "}
              {new Date(policy.updatedAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </MonoLabel>
          </div>
          <p className="text-sm text-muted-foreground">
            Edit any section and save. Open claims are re-checked under the new
            version straight away, and each precedent is checked against it.
          </p>
          <form action={updatePolicy} className="flex flex-col gap-4">
            <Textarea
              key={policy.version}
              name="policy"
              defaultValue={policy.text}
              rows={26}
              className="font-mono text-xs leading-relaxed"
            />
            <SubmitButton
              pending="Saving and re-checking…"
              className="self-start"
            >
              Save as v{policy.version + 1}
            </SubmitButton>
          </form>
          {previous && (
            <form action={updatePolicy}>
              <input type="hidden" name="policy" value={previous.text} />
              <SubmitButton pending="Restoring…" variant="ghost" size="sm">
                Restore the v{previous.version} text
              </SubmitButton>
            </form>
          )}
        </Cell>

        <div className="flex flex-col bg-background">
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-6 sm:px-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Precedents
              </h2>
              <p className="text-sm text-muted-foreground">
                Finance&apos;s rulings, numbered P1, P2… The model cites them
                like policy sections.
              </p>
            </div>
            <MonoLabel className="shrink-0">
              {active} active
              {precedents.length > active
                ? ` · ${precedents.length - active} retired`
                : ""}
            </MonoLabel>
          </div>
          {precedents.length === 0 && (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>No rulings yet</EmptyTitle>
                <EmptyDescription>
                  Override a verdict in the review inbox and it appears here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {[...precedents].reverse().map((p) => (
            <PrecedentRow
              key={p.id}
              precedent={p}
              policyVersion={policy.version}
              used={usage(p.id)}
            />
          ))}
        </div>
      </CellGrid>
    </>
  );
}

function PrecedentRow({
  precedent: p,
  policyVersion,
  used,
}: {
  precedent: Precedent;
  policyVersion: number;
  used: number;
}) {
  const check =
    p.policyCheck?.policyVersion === policyVersion ? p.policyCheck : undefined;
  const covered = !p.retiredAt && check?.verdict === p.verdict;

  return (
    <article
      className={cn(
        "flex gap-4 border-b border-line px-4 py-5 last:border-b-0 sm:px-8",
        covered && "bg-muted/50",
      )}
    >
      <IconTile icon={Gavel} className={cn(p.retiredAt && "opacity-50")} />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2",
          p.retiredAt && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{p.id}</span>
          <VerdictBadge verdict={p.verdict} />
          {p.retiredAt && <Badge variant="outline">Retired</Badge>}
          <MonoLabel className="ml-auto">
            from {p.claimId} · used {used}×
          </MonoLabel>
        </div>
        <p className="text-sm font-medium">&ldquo;{ruling(p.reason)}&rdquo;</p>
        {/* The stored summary is prompt text, so only its display is fixed. */}
        <p className="text-sm text-muted-foreground">
          {p.summary.replace(/\b1 people\b/, "1 person")}
        </p>
        {check && !p.retiredAt && (
          <p
            className={cn(
              "text-sm",
              covered ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {covered
              ? `Covered by policy v${policyVersion}: the policy alone now rules ${VERDICT_LABEL[check.verdict].toLowerCase()}, so this ruling can be retired.`
              : `Still needed: policy v${policyVersion} alone would rule ${VERDICT_LABEL[check.verdict].toLowerCase()}.`}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <div className="ml-auto flex gap-1">
            {p.retiredAt ? (
              <>
                <form action={reinstatePrecedent.bind(null, p.id)}>
                  <SubmitButton
                    pending="Reinstating…"
                    variant="ghost"
                    size="xs"
                  >
                    Reinstate
                  </SubmitButton>
                </form>
                <form action={deletePrecedent.bind(null, p.id)}>
                  <SubmitButton pending="Removing…" variant="ghost" size="xs">
                    Remove
                  </SubmitButton>
                </form>
              </>
            ) : (
              <form action={retirePrecedent.bind(null, p.id)}>
                <SubmitButton
                  pending="Retiring…"
                  variant={covered ? "outline" : "ghost"}
                  size="xs"
                >
                  Retire
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Impact({
  policy,
  previous,
  recheck,
  claims,
}: {
  policy: Policy;
  previous: Policy;
  recheck: Recheck;
  claims: ClaimRecord[];
}) {
  const changed = recheck.claims.filter((c) => c.after && c.after !== c.before);
  const covered = recheck.precedents.filter(
    (p) => p.policyVerdict === p.verdict,
  );
  const note = [
    `${changed.length} of ${recheck.claims.length} open claims changed`,
    `${covered.length} of ${recheck.precedents.length} precedents now covered`,
  ].join(" · ");

  return (
    <>
      <SectionHeader title={`What changed in v${policy.version}`}>
        <div className="flex items-center gap-3">
          <MonoLabel className="hidden sm:inline">{note}</MonoLabel>
          <form action={recheckOpenClaims}>
            <SubmitButton pending="Re-checking…" size="sm" variant="outline">
              Re-check open claims
            </SubmitButton>
          </form>
        </div>
      </SectionHeader>
      <CellGrid className="lg:grid-cols-2">
        <Cell className="flex flex-col gap-3">
          <MonoLabel>
            v{previous.version} → v{policy.version}
          </MonoLabel>
          <PolicyDiff before={previous.text} after={policy.text} />
        </Cell>
        <div className="flex flex-col bg-background">
          <div className="border-b border-line px-4 py-3 sm:px-8">
            <MonoLabel>
              open claims, re-checked under v{policy.version}
            </MonoLabel>
          </div>
          {recheck.claims.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground sm:px-8">
              No open claims to re-check.
            </p>
          )}
          {recheck.claims.map((r) => {
            const claim = claims.find((c) => c.id === r.id);
            const flipped = r.after && r.after !== r.before;
            return (
              <Link
                key={r.id}
                href={`/?filter=review&claim=${r.id}`}
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-muted/40 sm:px-8",
                  flipped && "bg-muted/50",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {claim?.merchant ?? r.id}
                  </span>
                  <MonoLabel>
                    {r.id} · {claim?.purpose}
                  </MonoLabel>
                </span>
                <span className="flex items-center gap-2">
                  <VerdictBadge
                    verdict={r.before}
                    className={cn(flipped && "opacity-50")}
                  />
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  {r.after ? (
                    <VerdictBadge verdict={r.after} />
                  ) : (
                    <MonoLabel>error</MonoLabel>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </CellGrid>
    </>
  );
}

type DiffPart = { kind: "same" | "removed" | "added"; text: string };

// Longest-common-subsequence diff of two token lists, removals before additions.
function diff(a: string[], b: string[]): DiffPart[] {
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      parts.push({ kind: "same", text: a[i++] });
      j++;
    } else if (
      i < a.length &&
      (j >= b.length || lcs[i + 1][j] >= lcs[i][j + 1])
    )
      parts.push({ kind: "removed", text: a[i++] });
    else parts.push({ kind: "added", text: b[j++] });
  }
  return parts;
}

// Changed policy lines, with the changed words marked when a line was edited
// rather than added or removed outright.
function PolicyDiff({ before, after }: { before: string; after: string }) {
  const changed = diff(before.split("\n"), after.split("\n")).filter(
    (l) => l.kind !== "same" && l.text.trim(),
  );
  if (changed.length === 0)
    return <p className="text-sm text-muted-foreground">No text changes.</p>;

  const counterpart = (k: number) => {
    const line = changed[k];
    const other = line.kind === "removed" ? changed[k + 1] : changed[k - 1];
    return other && other.kind !== line.kind ? other.text : undefined;
  };

  return (
    <div className="flex flex-col gap-1 font-mono text-xs leading-relaxed">
      {changed.map((l, k) => {
        const other = counterpart(k);
        const [oldText, newText] =
          l.kind === "removed" ? [l.text, other] : [other, l.text];
        const words =
          oldText !== undefined && newText !== undefined
            ? diff(oldText.split(/(\s+)/), newText.split(/(\s+)/)).filter(
                (w) => w.kind === "same" || w.kind === l.kind,
              )
            : [{ kind: "same" as const, text: l.text }];
        return (
          <p
            key={k}
            className={cn(
              "rounded-md px-2 py-1",
              l.kind === "removed"
                ? "text-muted-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <span className="mr-2 select-none">
              {l.kind === "removed" ? "−" : "+"}
            </span>
            {words.map((w, n) =>
              w.kind === "same" ? (
                w.text
              ) : (
                <mark
                  key={n}
                  className={cn(
                    "rounded-sm px-0.5",
                    l.kind === "removed"
                      ? "bg-violation-soft text-violation line-through"
                      : "bg-approve-soft font-semibold text-approve",
                  )}
                >
                  {w.text}
                </mark>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}
