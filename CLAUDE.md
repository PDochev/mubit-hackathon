# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — dev server at http://localhost:3000 (Turbopack)
- `npm run build` — production build; also the main type-check (no separate `tsc` script)
- `npm run start` — serve the production build
- `npm run lint` — ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript); `npx eslint <path>` for a single file
- `npx tsc --noEmit` — fast type-check while iterating; `npm run build` before calling something done
- `next build` can run while the user's `next dev` is up (dev uses `.next/dev`). Never kill their dev server.

There is no test runner configured yet. Verify UI changes in the browser (Playwright screenshots go in `.playwright-mcp/`, which is gitignored).

## Stack

Next.js 16.4 (App Router only, `app/`), React 19.3, TypeScript strict, Tailwind CSS v4, shadcn/ui (Base UI). The app pages live in the `app/(app)/` route group (shared header and footer); `/play` is the full-screen Night Shift game. See README.md for what each page and `lib/` file does.

Per AGENTS.md, this Next.js version differs from training data. The version-matched docs live in `node_modules/next/dist/docs/` (`01-app/` is the relevant section) — check them before using any Next API.

## Configuration that shapes how code must be written

- **Cache Components is on** (`cacheComponents: true` in `next.config.ts`). Data fetching and caching follow the `"use cache"` / `cacheLife` / `cacheTag` model and Partial Prerendering, not the older `fetch` cache options, route segment configs (`dynamic`, `revalidate`) or `unstable_cache`. Uncached or request-time data (`cookies()`, `headers()`, `searchParams`, uncached fetches) must sit inside a `<Suspense>` boundary; otherwise the dev overlay reports a "blocking-route" insight. See `01-app/01-getting-started/08-caching.md`.
- **Partial Prefetching is on** (`partialPrefetching: true`). `<Link>` prefetches a per-route App Shell by default rather than the full page. See `01-app/02-guides/adopting-partial-prefetching.md`.
- **Tailwind runs through a Turbopack loader, not PostCSS.** `next.config.ts` routes every `*.css` file through `@tailwindcss/turbopack`, and there is no `postcss.config`. Tailwind v4 is configured in CSS: `app/globals.css` uses `@import "tailwindcss"` and an `@theme inline` block that maps the `--background`/`--foreground` variables and the Geist font variables (from `next/font` in `layout.tsx`) to Tailwind tokens. Add design tokens there; there is no `tailwind.config.*`.
- **Typed route props are global.** Layouts and pages use the generated `LayoutProps<"/route">` / `PageProps<"/route">` helpers without importing them (they're generated into `.next/types` by `next dev`, `next build` or `npx next typegen`).
- Import alias `@/*` points to the repo root.

## Mubit and data

- Every model call goes through Mubit (`lib/mubit.ts`) and spends credit. Keep calls to a minimum, and copy `data/store.json` before any experiment that writes to it.
- **Don't edit `SYSTEM_PROMPT`, the user-message layout or the verdict schema in `lib/prompt.ts`.** Any change makes Mubit start a new task from 0 training examples.
- Record modes: `metadata` for anything no human has checked (first passes, re-checks, evals, the game audit); `full` only for the commit after a human verdict, kept only when the reply matches it.
- All state is `data/store.json` (gitignored). Write only through `updateStore()`, which serialises read-modify-write.
- Night Shift (`lib/game.ts`): each shift is in `store.games`, found by the `night-shift` cookie. Its rulings are numbered R1, R2… so they never collide with the inbox's precedents (P…). A full night is about 25 calls; the audit is 12.

## Night Shift scene (`app/play/`)

- Sizes inside the office use `cqw` (the `@container` is the 400×248 art). Pixel art uses `<img>`, never `next/image`, so it isn't resampled.
- Stepped CSS animations: don't use `steps()` with `fill-mode: both`. A finished animation can stop at progress 0.9999…, which `steps()` rounds to the second-to-last frame. Make the resting style the last frame and use `backwards` instead (see `.ns-stamp-mark` in `play.css`).
