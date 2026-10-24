import { CircleAlert, CircleCheck, CircleHelp, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HatchBand, IconTile, MonoLabel } from "@/components/app-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/lib/status";
import { readStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function Page({ params }: PageProps<"/submit/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-72" />}>
      <Result params={params} />
    </Suspense>
  );
}

async function Result({ params }: Pick<PageProps<"/submit/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const claim = (await readStore()).claims.find((c) => c.id === id);
  if (!claim) notFound();
  const first = claim.firstPass;

  const outcome =
    claim.final?.by === "auto"
      ? { title: "Approved.", icon: CircleCheck, tone: "text-approve", body: "Your claim meets the policy and has been approved." }
      : first?.verdict === "violation"
        ? { title: "Policy issue flagged.", icon: CircleAlert, tone: "text-violation", body: "Finance will review this claim before it's paid." }
        : first?.verdict === "needs_info"
          ? { title: "More information needed.", icon: CircleHelp, tone: "text-info", body: "Finance will follow up on what's missing." }
          : { title: "Sent to finance.", icon: Clock, tone: "text-foreground", body: "Finance will confirm this claim shortly." };

  return (
    <>
      <section className="screen-line-bottom px-4 py-16 sm:px-8">
        <div className="rise mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
          <IconTile icon={outcome.icon} className={outcome.tone} />
          <MonoLabel>
            {claim.id} · {claim.merchant} · {money(claim.amount)}
          </MonoLabel>
          <h1 className={cn("text-4xl font-semibold tracking-tighter sm:text-5xl", outcome.tone)}>{outcome.title}</h1>
          <p className="text-muted-foreground">{outcome.body}</p>
          {first && (
            <Alert className="text-left">
              <AlertTitle className="font-mono">{first.clause}</AlertTitle>
              <AlertDescription>
                {first.reason}
                {first.missing.length > 0 && <div className="text-info">Missing: {first.missing.join(", ")}</div>}
              </AlertDescription>
            </Alert>
          )}
          {claim.error && (
            <Alert variant="destructive" className="text-left">
              <AlertTitle>Couldn&apos;t check this claim</AlertTitle>
              <AlertDescription>{claim.error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-3">
            <Link href="/submit" className={buttonVariants()}>
              Submit another
            </Link>
            <Link href={`/?filter=all&claim=${claim.id}`} className={buttonVariants({ variant: "outline" })}>
              Finance view
            </Link>
          </div>
        </div>
      </section>
      <HatchBand />
    </>
  );
}
