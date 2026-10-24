import { ArrowRight, Inbox as InboxIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { approveClaim, overrideClaim } from "@/app/actions";
import {
  MonoLabel,
  PageHeader,
  PrecedentId,
  VERDICT_LABEL,
  VerdictBadge,
} from "@/components/app-ui";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatClaim, VERDICTS } from "@/lib/prompt";
import {
  claimStatus,
  money,
  STATUS_LABEL,
  type ClaimStatus,
} from "@/lib/status";
import { readStore } from "@/lib/store";
import type { ClaimRecord, Precedent } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  {
    id: "review",
    label: "Needs review",
    match: (c: ClaimRecord) => claimStatus(c) === "needs_review",
  },
  {
    id: "user",
    label: "Submitted",
    match: (c: ClaimRecord) => c.source === "user",
  },
  {
    id: "seed",
    label: "Seeded",
    match: (c: ClaimRecord) => c.source === "seed",
  },
  { id: "all", label: "All", match: () => true },
] as const;

const STATUS_STYLE: Record<ClaimStatus, string> = {
  error: "text-destructive",
  pending: "text-muted-foreground",
  needs_review: "font-medium text-info",
  auto_approved: "text-muted-foreground",
  approved: "text-muted-foreground",
  overridden: "font-medium text-foreground",
};

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader
        icon={InboxIcon}
        eyebrow="Finance review"
        title="Review inbox."
        subtitle="Teach it once."
        description="The model checks every claim against the policy and your precedents. Confirm it, or override it with a reason: the override becomes a precedent and a corrected training example."
      >
        <Link href="/submit" className={buttonVariants({ variant: "outline" })}>
          Submit an expense
          <ArrowRight data-icon="inline-end" />
        </Link>
      </PageHeader>
      <Suspense fallback={<Skeleton className="m-8 h-96" />}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Inbox({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const selectedId =
    typeof params.claim === "string" ? params.claim : undefined;
  const store = await readStore();
  // Open on the review queue, or on every claim when the queue is empty.
  const requested = FILTERS.find((f) => f.id === params.filter);
  const queueEmpty = !store.claims.some(FILTERS[0].match);
  const filter = requested ?? (queueEmpty ? FILTERS[3] : FILTERS[0]);
  const claims = store.claims.filter(filter.match).reverse();
  const selected = store.claims.find((c) => c.id === selectedId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 screen-line-bottom px-4 py-4 sm:px-8">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={`/?filter=${f.id}`}
              scroll={false}
              className={buttonVariants({
                variant: f.id === filter.id ? "secondary" : "ghost",
                size: "sm",
              })}
            >
              {f.label}
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {store.claims.filter(f.match).length}
              </span>
            </Link>
          ))}
        </div>
        {!requested && queueEmpty ? (
          <span className="text-sm text-muted-foreground">
            Nothing needs review. Showing every claim, newest first.
          </span>
        ) : (
          <MonoLabel>{claims.length} claims</MonoLabel>
        )}
      </div>

      <div
        className={cn(
          "grid screen-line-bottom",
          selected && "lg:grid-cols-[minmax(0,1fr)_420px]",
        )}
      >
        <div className="min-w-0">
          {claims.length === 0 ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>Nothing to review</EmptyTitle>
                <EmptyDescription>
                  <Link href="/submit">Submit an expense</Link> to see it
                  checked against the policy.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4 sm:[&_td:first-child]:pl-8 sm:[&_td:last-child]:pr-8 sm:[&_th:first-child]:pl-8 sm:[&_th:last-child]:pr-8">
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Model verdict</TableHead>
                  <TableHead>Status</TableHead>
                  {!selected && <TableHead>Training</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => {
                  const status = claimStatus(c);
                  return (
                    <TableRow
                      key={c.id}
                      data-state={c.id === selectedId ? "selected" : undefined}
                      className="h-14"
                    >
                      <TableCell>
                        <Link
                          href={`/?filter=${filter.id}&claim=${c.id}`}
                          scroll={false}
                          className="group flex flex-col"
                        >
                          <span className="font-medium group-hover:underline">
                            {c.employee}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.id} · {c.category}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>{c.merchant}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(c.amount)}
                      </TableCell>
                      <TableCell>
                        {c.firstPass ? (
                          <div className="flex items-center gap-2">
                            <VerdictBadge verdict={c.firstPass.verdict} />
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              {Math.round(c.firstPass.confidence * 100)}%
                            </span>
                            {c.previousPass &&
                              c.previousPass.verdict !==
                                c.firstPass.verdict && (
                                <MonoLabel>
                                  was{" "}
                                  {VERDICT_LABEL[
                                    c.previousPass.verdict
                                  ].toLowerCase()}
                                </MonoLabel>
                              )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={STATUS_STYLE[status]}>
                        {STATUS_LABEL[status]}
                      </TableCell>
                      {!selected && (
                        <TableCell className="font-mono text-xs">
                          {c.commit?.status === "verified" ? (
                            <span className="text-learn">● example sent</span>
                          ) : c.commit ? (
                            <span className="text-destructive">
                              ● unverified
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        {selected && (
          <ClaimPanel
            claim={selected}
            filter={filter.id}
            precedents={store.precedents}
          />
        )}
      </div>
    </>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-5 py-5 last:border-b-0">
      <MonoLabel>{title}</MonoLabel>
      {children}
    </section>
  );
}

function ClaimPanel({
  claim,
  filter,
  precedents,
}: {
  claim: ClaimRecord;
  filter: string;
  precedents: Precedent[];
}) {
  const status = claimStatus(claim);
  const first = claim.firstPass;
  const used = precedents.filter((p) => first?.precedentIds.includes(p.id));
  const created = precedents.find((p) => p.id === claim.final?.precedentId);

  return (
    <aside className="h-fit border-t border-line bg-background lg:sticky lg:top-16 lg:border-t-0 lg:border-l">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5">
        <div className="flex flex-col gap-1">
          <MonoLabel>
            {claim.id} · {STATUS_LABEL[status]}
          </MonoLabel>
          <h2 className="text-xl font-semibold tracking-tight">
            {claim.merchant}
          </h2>
        </div>
        <Link
          href={`/?filter=${filter}`}
          scroll={false}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Close
        </Link>
      </div>

      <PanelSection title="Claim">
        <pre className="rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {formatClaim(claim)}
        </pre>
      </PanelSection>

      {first && (
        <PanelSection title="Model verdict">
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={first.verdict} />
            <span className="font-mono text-sm">{first.clause}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
              {Math.round(first.confidence * 100)}% ·{" "}
              {(first.latencyMs / 1000).toFixed(1)}s
            </span>
          </div>
          <p className="text-sm">{first.reason}</p>
          {first.missing.length > 0 && (
            <p className="text-sm text-info">
              Missing: {first.missing.join(", ")}
            </p>
          )}
          <MonoLabel>
            precedents:{" "}
            {used.length
              ? used.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <PrecedentId id={p.id} />
                  </span>
                ))
              : "none"}{" "}
            · policy v{first.policyVersion}
          </MonoLabel>
          {claim.previousPass && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Re-checked after the policy changed. Under v
              {claim.previousPass.policyVersion} it was
              <VerdictBadge verdict={claim.previousPass.verdict} />
            </div>
          )}
        </PanelSection>
      )}

      {claim.error && (
        <PanelSection title="Error">
          <Alert variant="destructive">
            <AlertTitle>Model call failed</AlertTitle>
            <AlertDescription>{claim.error}</AlertDescription>
          </Alert>
        </PanelSection>
      )}

      {claim.final && (
        <PanelSection title="Finance decision">
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={claim.final.verdict} />
            <span className="text-sm text-muted-foreground">
              {claim.final.by === "auto" ? "auto-approved" : "by reviewer"}
            </span>
          </div>
          {claim.final.reason && (
            <p className="text-sm">{claim.final.reason}</p>
          )}
          {created && (
            <MonoLabel>
              saved as precedent <PrecedentId id={created.id} />
            </MonoLabel>
          )}
          {claim.commit && (
            <Alert
              variant={
                claim.commit.status === "verified" ? "default" : "destructive"
              }
            >
              <AlertTitle>
                {claim.commit.status === "verified"
                  ? "Corrected training example sent to Mubit"
                  : "Re-run disagreed with the decision; not a clean example"}
              </AlertTitle>
              <AlertDescription className="font-mono text-xs">
                {claim.commit.mubitRequestId}
              </AlertDescription>
            </Alert>
          )}
        </PanelSection>
      )}

      {status === "needs_review" && first && (
        <PanelSection title="Your decision">
          <form action={approveClaim.bind(null, claim.id)}>
            <SubmitButton
              pending="Confirming…"
              variant="outline"
              className="w-full"
            >
              Confirm “{VERDICT_LABEL[first.verdict]}”
            </SubmitButton>
          </form>
          <form action={overrideClaim}>
            <input type="hidden" name="id" value={claim.id} />
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Or override to</FieldLegend>
                <RadioGroup
                  name="verdict"
                  defaultValue={VERDICTS.find((v) => v !== first.verdict)}
                  className="grid-cols-3"
                >
                  {VERDICTS.map((v) => (
                    <FieldLabel key={v} htmlFor={`verdict-${v}`}>
                      <Field orientation="horizontal">
                        <RadioGroupItem value={v} id={`verdict-${v}`} />
                        {VERDICT_LABEL[v]}
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="reason">
                  Ruling (becomes the precedent)
                </FieldLabel>
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  rows={3}
                  placeholder="e.g. Client coffees under £25 don't need attendee details."
                />
              </Field>
              <SubmitButton pending="Teaching the model…" className="w-full">
                Override and save precedent
              </SubmitButton>
            </FieldGroup>
          </form>
        </PanelSection>
      )}
    </aside>
  );
}
