# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — dev server at http://localhost:3000 (Turbopack)
- `npm run build` — production build; also the main type-check (no separate `tsc` script)
- `npm run start` — serve the production build
- `npm run lint` — ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript); `npx eslint <path>` for a single file

There is no test runner configured yet.

## Stack

Next.js 16.4 (App Router only, `app/`), React 19.3, TypeScript strict, Tailwind CSS v4. The repo is currently the `create-next-app` scaffold; `app/page.tsx` and the `metadata` in `app/layout.tsx` are placeholders.

Per AGENTS.md, this Next.js version differs from training data. The version-matched docs live in `node_modules/next/dist/docs/` (`01-app/` is the relevant section) — check them before using any Next API.

## Configuration that shapes how code must be written

- **Cache Components is on** (`cacheComponents: true` in `next.config.ts`). Data fetching and caching follow the `"use cache"` / `cacheLife` / `cacheTag` model and Partial Prerendering, not the older `fetch` cache options, route segment configs (`dynamic`, `revalidate`) or `unstable_cache`. Uncached or request-time data (`cookies()`, `headers()`, `searchParams`, uncached fetches) must sit inside a `<Suspense>` boundary; otherwise the dev overlay reports a "blocking-route" insight. See `01-app/01-getting-started/08-caching.md`.
- **Partial Prefetching is on** (`partialPrefetching: true`). `<Link>` prefetches a per-route App Shell by default rather than the full page. See `01-app/02-guides/adopting-partial-prefetching.md`.
- **Tailwind runs through a Turbopack loader, not PostCSS.** `next.config.ts` routes every `*.css` file through `@tailwindcss/turbopack`, and there is no `postcss.config`. Tailwind v4 is configured in CSS: `app/globals.css` uses `@import "tailwindcss"` and an `@theme inline` block that maps the `--background`/`--foreground` variables and the Geist font variables (from `next/font` in `layout.tsx`) to Tailwind tokens. Add design tokens there; there is no `tailwind.config.*`.
- **Typed route props are global.** Layouts and pages use the generated `LayoutProps<"/route">` / `PageProps<"/route">` helpers without importing them (they're generated into `.next/types` by `next dev`, `next build` or `npx next typegen`).
- Import alias `@/*` points to the repo root.
