import { ArrowRight, CarTaxiFront, Coffee, Receipt, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { submitClaim } from "@/app/actions";
import { Cell, CellGrid, IconTile, PageHeader, SectionHeader } from "@/components/app-ui";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Category, Claim } from "@/lib/types";
import { cn } from "@/lib/utils";

type Example = Partial<Omit<Claim, "amount" | "headcount">> & {
  amount?: number;
  headcount?: number;
  label: string;
  note: string;
  icon: LucideIcon;
};

// One-tap fills for the live demo; each hits a case the written policy is
// unclear about.
const EXAMPLES: Record<string, Example> = {
  coffee: { label: "Client coffee", note: "£8.40 at Pret, no attendee names", icon: Coffee, category: "meals", merchant: "Pret A Manger", amount: 8.4, headcount: 2, attendees: "a prospective client", purpose: "Coffee with a prospect from a fintech startup", receipt: false },
  taxi: { label: "Taxi after client dinner", note: "Uber at 20:30, before the 21:00 rule", icon: CarTaxiFront, category: "taxi", merchant: "Uber", amount: 24.5, datetime: "2026-10-23T20:30", purpose: "Home straight after client dinner with Acme Corp", receipt: false },
  contractor: { label: "Team + contractor dinner", note: "£236 for 5 at Dishoom", icon: Users, category: "meals", merchant: "Dishoom", amount: 236, headcount: 5, attendees: "Northwind team (4 people) and Jamie Fox (freelance designer, contractor)", purpose: "Dinner with the team and our freelance designer", receipt: true },
  client: { label: "Client dinner", note: "£210 for 3 at Hawksmoor", icon: UtensilsCrossed, category: "meals", merchant: "Hawksmoor", amount: 210, headcount: 3, attendees: "Sarah Lee (Acme Corp), James Patel (Halcyon Bank), plus me", purpose: "Dinner with clients to discuss renewal", receipt: true },
};

const CATEGORIES: Category[] = ["meals", "taxi", "rail", "hotel", "software", "other"];

export default function Page({ searchParams }: PageProps<"/submit">) {
  return (
    <>
      <PageHeader
        icon={Receipt}
        eyebrow="Employee"
        title="Submit an expense."
        subtitle="Checked in seconds."
        description="Precedent checks it against Northwind's written policy and every ruling the finance team has made on top of it."
      />
      <Suspense fallback={<Skeleton className="m-8 h-[640px]" />}>
        <ClaimForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClaimForm({ searchParams }: Pick<PageProps<"/submit">, "searchParams">) {
  await connection();
  const { example } = await searchParams;
  const e: Partial<Example> = (typeof example === "string" && EXAMPLES[example]) || {};
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <>
      <SectionHeader title="Start with an example" note="Cases the written policy is unclear about" />
      <CellGrid className="sm:grid-cols-2">
        {Object.entries(EXAMPLES).map(([id, ex]) => (
          <Link
            key={id}
            href={`/submit?example=${id}`}
            scroll={false}
            className={cn("group flex items-center gap-4 bg-background px-4 py-5 transition-colors hover:bg-muted/40 sm:px-8", example === id && "bg-muted/60")}
          >
            <IconTile icon={ex.icon} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-sm">{ex.label}</span>
              <span className="truncate text-sm text-muted-foreground">{ex.note}</span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </CellGrid>

      <SectionHeader title="Expense details" note="Everything goes to the model as plain text" />
      {/* key resets the uncontrolled inputs when a different example is picked */}
      <Cell key={String(example)} className="screen-line-bottom">
        <form action={submitClaim} className="mx-auto max-w-2xl">
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="employee">Your name</FieldLabel>
              <Input id="employee" name="employee" defaultValue={e.employee ?? ""} placeholder="Alex Morgan" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="category">Category</FieldLabel>
              <NativeSelect id="category" name="category" defaultValue={e.category ?? "meals"}>
                {CATEGORIES.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {c}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
              <Input id="merchant" name="merchant" defaultValue={e.merchant ?? ""} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">Amount (£)</FieldLabel>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={e.amount ?? ""} required className="font-mono" />
            </Field>
            <Field>
              <FieldLabel htmlFor="datetime">Date and time</FieldLabel>
              <Input id="datetime" name="datetime" type="datetime-local" defaultValue={e.datetime ?? local} required className="font-mono" />
            </Field>
            <Field>
              <FieldLabel htmlFor="headcount">People (incl. you)</FieldLabel>
              <Input id="headcount" name="headcount" type="number" min="1" defaultValue={e.headcount ?? 1} className="font-mono" />
            </Field>
            <Field>
              <FieldLabel htmlFor="attendees">Attendees</FieldLabel>
              <Input id="attendees" name="attendees" defaultValue={e.attendees ?? ""} placeholder="Names and companies" />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="purpose">Business purpose</FieldLabel>
              <Input id="purpose" name="purpose" defaultValue={e.purpose ?? ""} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="approvalRef">Approval ref (software)</FieldLabel>
              <Input id="approvalRef" name="approvalRef" defaultValue={e.approvalRef ?? ""} placeholder="APR-1234" className="font-mono" />
            </Field>
            <Field orientation="horizontal" className="self-end pb-2">
              <Checkbox id="receipt" name="receipt" value="yes" defaultChecked={e.receipt ?? false} />
              <FieldLabel htmlFor="receipt">Receipt attached</FieldLabel>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="receiptText">Receipt text (optional)</FieldLabel>
              <Textarea id="receiptText" name="receiptText" rows={2} defaultValue={e.receiptText ?? ""} placeholder="e.g. 2x Peroni £11.00, service 12.5%" />
            </Field>
            <SubmitButton pending="Checking against policy…" size="lg" className="sm:col-span-2">
              Submit expense
            </SubmitButton>
          </FieldGroup>
        </form>
      </Cell>
    </>
  );
}
