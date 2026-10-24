import Link from "next/link";
import { Suspense } from "react";
import { Nav } from "@/components/nav";

// The reviewer app's chrome. /play sits outside this group and runs full screen.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-40 screen-line-bottom bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 border-x border-line px-4 sm:px-8">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold tracking-tight"
          >
            precedent.
          </Link>
          <Suspense>
            <Nav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 border-x border-line">
        {children}
      </main>
      {/* -mt-px lays the footer's line over the last section's bottom line. */}
      <footer className="-mt-px screen-line-top">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-x border-line px-4 py-6 text-sm sm:px-8">
          <div className="flex items-center gap-4">
            <span className="font-semibold tracking-tight">precedent.</span>
            <span className="text-muted-foreground">
              Every ruling becomes a model update.
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            routed through Mubit
          </span>
        </div>
      </footer>
    </>
  );
}
