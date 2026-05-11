# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript stock dashboard with a Vite React client and an Express/TRPC server. Client code lives in `client/src`: pages in `pages/`, UI in `components/`, hooks in `hooks/`, and utilities in `lib/`. Static browser assets belong in `client/public`.

Server code lives in `server/`, with runtime helpers under `server/_core/`, route composition in `server/routers.ts`, and services such as `stockData.ts` and `llmAnalysis.ts`. Shared cross-tier types and constants live in `shared/`. Database schema and migrations live in `drizzle/`. Production output goes to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

- `corepack pnpm install`: install dependencies with the pinned pnpm version.
- `corepack pnpm dev`: run the development server with `tsx watch`.
- `corepack pnpm test`: run Vitest server tests.
- `corepack pnpm check`: run TypeScript type checking with `tsc --noEmit`.
- `corepack pnpm build`: build the Vite client and bundled Node server into `dist/`.
- `corepack pnpm start`: run `dist/index.js`.
- `corepack pnpm format`: format the repository with Prettier.
- `corepack pnpm db:push`: generate and apply Drizzle migrations; needs `DATABASE_URL`.

## Coding Style & Naming Conventions

Use strict TypeScript and ESM imports. Follow the existing style: 2-space indentation, double quotes, semicolons, and named exports where practical. React components use `PascalCase`, hooks use `useCamelCase`, and tests mirror behavior or module names, for example `auth.routes.test.ts`. Prefer aliases: `@/*` for `client/src` and `@shared/*` for `shared`.

For UI work, reuse Radix/shadcn-style components from `client/src/components/ui` before adding primitives. Keep server response shapes compatible with existing client expectations.

## Testing Guidelines

Vitest is configured for Node tests matching `server/**/*.test.ts` and `server/**/*.spec.ts`. Add targeted tests beside server behavior changes, especially auth, cookies, stock data, ETF logic, and LLM wrappers. Run `corepack pnpm test` and `corepack pnpm check` before handoff; run `corepack pnpm build` for integration or client-facing changes.

## Commit & Pull Request Guidelines

This checkout has no local `.git` history to summarize. Follow the repository Lore protocol: start with a concise intent line explaining why the change exists, then add useful trailers such as `Constraint:`, `Rejected:`, `Confidence:`, `Scope-risk:`, `Tested:`, and `Not-tested:`.

Pull requests should include the user-visible change, verification commands run, database or environment changes, and screenshots for UI changes. Link related issues when available.

## Security & Configuration Tips

Do not commit secrets. Runtime configuration includes `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`, and `PORT`. Keep Drizzle schema changes paired with generated migration files.
