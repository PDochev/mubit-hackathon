"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; short?: string }[] = [
  { href: "/", label: "Inbox" },
  { href: "/submit", label: "Submit" },
  { href: "/policy", label: "Policy" },
  { href: "/loop", label: "Learning loop", short: "Loop" },
  { href: "/play", label: "Night Shift", short: "Play" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="-mr-2 flex items-center overflow-x-auto text-sm">
      {LINKS.map(({ href, label, short }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-2 py-1.5 font-medium sm:px-2.5 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground underline decoration-1 underline-offset-[6px]",
            )}
          >
            {short ? (
              <>
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            ) : (
              label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
