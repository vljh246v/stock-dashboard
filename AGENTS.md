# Agent Guide

Keep this file short. Put durable details in [docs/agent-reference.md](docs/agent-reference.md) and update that reference instead of expanding this file.

## Project Contract

- StockPulse is a Korean stock analysis dashboard: Vite React client, Express/tRPC server, Drizzle/MySQL storage, Yahoo/OpenAI-backed analysis.
- Trust boundary: show only source-backed financial values. If source, freshness, or calculation confidence is weak, display `확인 불가` / `공식 원천 확인 필요` rather than inventing numbers.
- LLMs may summarize, translate, and explain evidence; they must not create unsupported numeric evidence or overstate investment certainty.

## Work Rules

- Keep diffs small, focused, and reversible. Do not touch `dist/` by hand.
- Preserve existing user changes. Check `git status --short` before broad edits.
- Reuse local patterns and shadcn/Radix UI primitives before adding new abstractions or dependencies.
- Keep secrets out of commits. Runtime env keys are documented in [.env.example](.env.example) and [deploy/README.md](deploy/README.md).

## Commands

Use the package scripts in [package.json](package.json). Default verification for code changes:

```sh
corepack pnpm test
corepack pnpm check
corepack pnpm build
```

Run narrower tests first when changing a single server behavior.

## References

- Architecture, conventions, testing, and commit format: [docs/agent-reference.md](docs/agent-reference.md)
- Deployment contract and OCI/Nginx notes: [deploy/README.md](deploy/README.md)
- Current product/UX plans: [.omx/plans](.omx/plans) and [.omx/specs](.omx/specs)
