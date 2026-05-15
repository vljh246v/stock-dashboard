# Stock Dashboard Agent Reference

This file holds the detail that should not bloat `AGENTS.md`.

## Project Map

- `client/src/pages`: route-level screens for home, login, and dashboard.
- `client/src/components`: dashboard shell and section components.
- `client/src/components/ui`: shadcn/Radix-style primitives; reuse these before adding UI primitives.
- `client/src/lib` and `client/src/hooks`: client helpers, tRPC client, watchlist display, and local hooks.
- `server/_core`: Express/tRPC bootstrap, auth context, cookies, env, LLM adapter, migration runner, and Vite integration.
- `server/routers.ts`: app router composition and user-facing API procedures.
- `server/stockData.ts`: Yahoo Finance, SEC filing, and ETF holding fetch/caching.
- `server/llmAnalysis.ts` and `server/multiAgentAnalysis.ts`: OpenAI-backed Korean analysis and opinion generation.
- `server/opinionTracking.ts` plus `server/opinionTracking*.test.ts`: immutable opinion snapshots and 1/3-month outcome resolution.
- `shared`: cross-tier types, constants, symbols, date helpers, and financial term mappings.
- `drizzle/schema.ts` and `drizzle/000*.sql`: MySQL schema and migrations.

## Product Constraints

- The app is moving toward a subscription-ready premium analysis product. Existing planning artifacts live under `.omx/plans` and `.omx/specs`.
- First paid-value direction: premium per-symbol reports and a numeric score dashboard, built on the existing cache/LLM infrastructure before payment work.
- Opinion tracking is a trust feature: snapshots are immutable, outcomes are resolved from later price data, and UI copy should avoid promising prediction accuracy.
- Indicator/guidance tabs should be beginner-readable and explain metrics near the metric itself.
- When reliable source-backed data is missing, hide the value or show `확인 불가` / `공식 원천 확인 필요`.

## Commands

- `corepack pnpm install`: install with pinned pnpm.
- `corepack pnpm dev`: run the local dev server with `tsx watch`.
- `corepack pnpm test`: run Vitest tests.
- `corepack pnpm check`: run `tsc --noEmit`.
- `corepack pnpm build`: build Vite client and bundled Node server into `dist/`.
- `corepack pnpm start`: run `dist/index.js`.
- `corepack pnpm format`: run Prettier.
- `corepack pnpm db:push`: generate and apply Drizzle migrations; requires `DATABASE_URL`.

## Testing Guidance

- Server tests live beside server modules and match `server/**/*.test.ts` / `server/**/*.spec.ts`.
- Add targeted tests for auth, cookies, stock data, ETF logic, LLM wrappers, opinion tracking, render contracts, and database changes.
- For UI-visible behavior, prefer existing render-contract tests before broad browser checks.
- Standard handoff evidence for code changes is `corepack pnpm test`, `corepack pnpm check`, and `corepack pnpm build`. If one cannot run, report the gap.

## Style

- TypeScript is strict and ESM-based.
- Use 2-space indentation, double quotes, semicolons, and named exports where practical.
- React components use `PascalCase`; hooks use `useCamelCase`.
- Prefer aliases from `tsconfig.json`: `@/*` for `client/src/*`, `@shared/*` for `shared/*`.
- Keep server response shapes compatible with existing client expectations.
- For financial Korean copy, be conservative: use evidence language, dates, and uncertainty rather than promotional certainty.

## Security And Deployment

- Do not commit secrets. `.env.example` documents local keys.
- Runtime env includes `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`, optional `OWNER_OPEN_ID`, `ENABLE_LOCAL_DB_FALLBACK`, and `PORT`.
- Deployment details are in `deploy/README.md`; production expects private MySQL on the VM and app traffic behind Nginx.
- Do not open MySQL `3306` or app `3000` publicly.

## Commit Protocol

Use the Lore-style decision record when committing:

```text
<why this change exists>

Constraint: <external constraint>
Rejected: <alternative> | <reason>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Tested: <verification run>
Not-tested: <known gaps>
```

Only include trailers that add real decision context.
