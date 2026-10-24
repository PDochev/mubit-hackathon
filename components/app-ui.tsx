import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { Verdict } from "@/lib/prompt";
import { cn } from "@/lib/utils";

// Verdict colours and the cobalt "learn" accent are the only colour in the UI (see globals.css).
const VERDICT_STYLE: Record<Verdict, string> = {
  approve: "bg-approve-soft text-approve",
  violation: "bg-violation-soft text-violation",
  needs_info: "bg-info-soft text-info",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  approve: "Approve",
  violation: "Violation",
  needs_info: "Needs info",
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return <Badge className={cn(VERDICT_STYLE[verdict], className)}>{VERDICT_LABEL[verdict]}</Badge>;
}

// A precedent's ID, in the accent colour wherever it appears.
export function PrecedentId({ id, className }: { id: string; className?: string }) {
  return <span className={cn("font-mono font-medium text-learn", className)}>{id}</span>;
}

// A before → after figure: the old value grey, the learned value in the accent.
export function BeforeAfter({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <>
      <span className="text-muted-foreground">{before}</span> → <span className="text-learn">{after}</span>
    </>
  );
}

// Stagger helper for the `rise` entrance animation.
export const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-background shadow-xs ring-1 ring-border", className)}>
      <Icon className="size-4 text-foreground" strokeWidth={1.75} />
    </span>
  );
}

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  description,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <header className="screen-line-bottom px-4 pt-8 pb-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="rise flex items-center gap-2 text-sm text-muted-foreground">
              <span className="grid size-6 place-items-center rounded-md ring-1 ring-border">
                <Icon className="size-3.5" strokeWidth={1.75} />
              </span>
              {eyebrow}
            </span>
            <h1 className="rise text-3xl leading-[1.05] font-semibold tracking-tighter sm:text-4xl" style={rise(1)}>
              {title}
              {subtitle && <span className="block text-muted-foreground">{subtitle}</span>}
            </h1>
            {description && (
              <p className="rise max-w-xl leading-relaxed text-muted-foreground" style={rise(2)}>
                {description}
              </p>
            )}
          </div>
          {children && (
            <div className="rise flex items-center gap-2" style={rise(3)}>
              {children}
            </div>
          )}
        </div>
      </header>
      <HatchBand />
    </>
  );
}

// A full-width diagonal-ruled band between sections.
export function HatchBand({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-8 screen-line-bottom", className)}>
      <div className="absolute inset-y-0 -left-[100vw] w-[200vw] bg-hatch" />
    </div>
  );
}

export function SectionHeader({ title, note, children }: { title: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 screen-line-bottom px-4 py-5 sm:px-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children ?? (note && <span className="text-sm text-muted-foreground">{note}</span>)}
    </div>
  );
}

// Cells separated by hairlines (the grid gap shows the line colour).
export function CellGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-px bg-line screen-line-bottom", className)}>{children}</div>;
}

export function Cell({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("bg-background px-4 py-6 sm:px-8", className)} style={style}>
      {children}
    </div>
  );
}

export function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</span>;
}

export function FigCaption({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="mr-1.5 text-muted-foreground/70">Fig. {n}.</span>
      {children}
    </p>
  );
}

// Cells sit on the line-coloured grid, so animate their contents, not the
// cell (a fading cell would flash the grid colour).
export function StatCell({ label, value, hint, index = 0 }: { label: string; value: ReactNode; hint?: ReactNode; index?: number }) {
  return (
    <Cell>
      <div className="rise flex flex-col gap-2" style={rise(index)}>
        <MonoLabel>{label}</MonoLabel>
        <div className="text-3xl font-semibold tracking-tighter tabular-nums">{value}</div>
        {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
      </div>
    </Cell>
  );
}
