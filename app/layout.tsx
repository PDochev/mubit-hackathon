import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/app-ui";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Precedent",
  description: "Expense policy review that learns from every finance override.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 screen-line-bottom bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 border-x border-line px-4 sm:px-8">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <BrandMark />
              <span className="text-lg font-semibold tracking-tight">precedent.</span>
            </Link>
            <Suspense>
              <Nav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 border-x border-line">{children}</main>
        <footer className="screen-line-top">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-x border-line px-4 py-6 text-sm sm:px-8">
            <div className="flex items-center gap-4">
              <span className="font-semibold tracking-tight">precedent.</span>
              <span className="text-muted-foreground">Every ruling becomes a model update.</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">routed through Mubit</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
