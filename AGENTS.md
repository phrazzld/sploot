# Repository Guidelines

## Project Structure & Module Organization
Sploot is a Next.js App Router service built with TypeScript.
- `app/` contains routes, layouts, and server actions—co-locate route-only components inside their folder.
- `components/` and `hooks/` expose reusable UI and client utilities; cross-cutting logic lives in `lib/`.
- `prisma/` manages the database schema, migrations, and `seed.ts`; update it whenever storage changes.
- `__tests__/` mirrors runtime modules (`api/`, `integration/`, `utils/`) for Jest coverage.
- `public/` holds static assets, while `scripts/` and `docs/` capture automation and longer-form notes.

## Build, Test, and Development Commands
Prefer `pnpm` to match the lockfile.
- `pnpm dev` boots the Next.js dev server at `localhost:3000` (requires `.env.local`).
- `pnpm build` compiles with Turbopack; run it before cutting a release.
- `pnpm start` serves the production build for smoke testing.
- `pnpm lint` and `pnpm type-check` enforce ESLint rules and TypeScript safety nets.
- `pnpm test`, `pnpm test:watch`, and `pnpm test:coverage` run the Jest suite.
- `pnpm db:migrate:dev` plus `pnpm db:seed` keep your Prisma schema current locally.

## Coding Style & Naming Conventions
Use two-space indentation and strict TypeScript types. Components, hooks, and React files follow `PascalCase`; utilities stay `camelCase`. Styling is Tailwind-first—compose utility classes and deduplicate them with `clsx` or `tailwind-merge`. Run `pnpm lint` before sending code for review, and commit only clean output.

## Testing Guidelines
Jest with `@testing-library/react` powers UI and integration coverage. Create specs alongside the related runtime module using the `*.test.ts` suffix. Mock outbound requests with MSW primitives configured in `jest.setup.ts`. Check `pnpm test:coverage` to maintain or raise the existing threshold, and refresh fixtures in `__tests__/utils/` when API shapes move.

## Commit & Pull Request Guidelines
Write imperative, under-72-character commit subjects (for example, `Add asset search filters`) and include extra context in the body when necessary. Reference issues with `#123` syntax. Pull requests should explain motivation, list manual or automated verification, and attach screenshots for UI changes. Confirm lint, types, and tests succeed before requesting review.

## Environment & Services
Follow the service setup notes in `SETUP_CLERK.md`, `SETUP_REDIS.md`, `SETUP_REPLICATE.md`, `SETUP_BLOB.md`, and `SETUP_DATABASE.md` when creating secrets. Store credentials only in `.env.local` (ignored by git). During deploys, run `pnpm db:migrate` to apply Prisma migrations.
