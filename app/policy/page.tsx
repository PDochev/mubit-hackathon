import { BookOpenText, Gavel } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { deletePrecedent, updatePolicy } from "@/app/actions";
import { Cell, CellGrid, IconTile, MonoLabel, PageHeader, VerdictBadge } from "@/components/app-ui";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { readStore } from "@/lib/store";

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
  const { policy, precedents, claims } = await readStore();
  const usage = (id: string) => claims.filter((c) => c.firstPass?.precedentIds.includes(id)).length;

  return (
    <CellGrid className="lg:grid-cols-2">
      <Cell className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Expense policy</h2>
          <MonoLabel>
            v{policy.version} · {new Date(policy.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </MonoLabel>
        </div>
        <form action={updatePolicy} className="flex flex-col gap-4">
          <Textarea name="policy" defaultValue={policy.text} rows={26} className="font-mono text-xs leading-relaxed" />
          <SubmitButton pending="Saving…" className="self-start">
            Save as v{policy.version + 1}
          </SubmitButton>
        </form>
      </Cell>

      <div className="flex flex-col bg-background">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-6 sm:px-8">
          <h2 className="text-lg font-semibold tracking-tight">Precedents</h2>
          <MonoLabel>{precedents.length} rulings</MonoLabel>
        </div>
        {precedents.length === 0 && (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyTitle>No rulings yet</EmptyTitle>
              <EmptyDescription>Override a verdict in the review inbox and it appears here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {[...precedents].reverse().map((p) => (
          <article key={p.id} className="flex gap-4 border-b border-line px-4 py-5 last:border-b-0 sm:px-8">
            <IconTile icon={Gavel} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{p.id}</span>
                <VerdictBadge verdict={p.verdict} />
                <MonoLabel className="ml-auto">
                  from {p.claimId} · used {usage(p.id)}×
                </MonoLabel>
              </div>
              <p className="text-sm font-medium">{p.reason}</p>
              <p className="text-xs text-muted-foreground">{p.summary}</p>
              <div className="flex flex-wrap items-center gap-1">
                {p.tags.map((t) => (
                  <Badge key={t} variant="outline" className="font-mono font-normal">
                    {t}
                  </Badge>
                ))}
                <form action={deletePrecedent.bind(null, p.id)} className="ml-auto">
                  <SubmitButton pending="Removing…" variant="ghost" size="xs">
                    Remove
                  </SubmitButton>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </CellGrid>
  );
}
