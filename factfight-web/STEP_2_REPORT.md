# FactFight migration Step 2 report

Date: 2026-07-15

Status: complete

Scope: isolated Next.js application foundation only. No authentication, Supabase configuration, API integration, feed, claims, voting, moderation, backend, SQL, DNS, or deployment work was performed.

## Scaffold inspection

Before Step 2, `factfight-web/` contained only `MIGRATION_AUDIT.md`. No `create-next-app` scaffold, `package.json`, source directory, or build configuration existed, so the isolated application foundation was created from scratch.

## Files created

- `.gitignore`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `next-env.d.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/styles/tokens.css`
- `src/components/navigation/.gitkeep`
- `src/components/ui/.gitkeep`
- `src/lib/api/.gitkeep`
- `src/lib/auth/.gitkeep`
- `src/lib/supabase/.gitkeep`
- `src/lib/types/.gitkeep`
- `src/lib/utils/.gitkeep`
- `src/lib/validation/.gitkeep`
- `STEP_2_REPORT.md`

Generated and ignored locally:

- `node_modules/`
- `.next/`
- `tsconfig.tsbuildinfo`

## Files changed

No pre-existing file was changed. `MIGRATION_AUDIT.md` was read before implementation and remained unchanged.

## Packages installed

Application dependencies:

- `next@16.2.10`
- `react@19.2.7`
- `react-dom@19.2.7`
- `@supabase/supabase-js@2.110.6`
- `@supabase/ssr@0.12.3`
- `lucide-react@1.24.0`
- `zod@4.4.3`

Development dependencies required by the requested scaffold:

- `typescript@6.0.3`
- `tailwindcss@4.3.2`
- `@tailwindcss/postcss@4.3.2`
- `eslint@9.39.5`
- `eslint-config-next@16.2.10`
- `@types/node@26.1.1`
- `@types/react@19.2.17`
- `@types/react-dom@19.2.3`

The Supabase packages are installed only. No Supabase client, environment configuration, or initialization was added.

## Commands executed

Required setup and verification commands:

```text
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

The first install selected the registry's newest TypeScript 7 and ESLint 10 releases. The first lint attempt exposed incompatibility with the TypeScript ESLint packages used by `eslint-config-next`. Package metadata and the installed dependency tree were inspected, then the scaffold was aligned to supported versions:

```text
npm.cmd view <package> version
npm.cmd view eslint-config-next@16.2.10 peerDependencies --json
npm.cmd ls typescript eslint @typescript-eslint/parser typescript-eslint --all
npm.cmd install
```

After alignment, lint, typecheck, and build were rerun successfully. Additional read-only validation included:

```text
npm.cmd ls --depth=0
npm.cmd audit --json
```

A local production-server smoke test was also run on `127.0.0.1:3100`. It confirmed HTTP 200 and the rendered presence of:

- `FactFight`
- `Fight misinformation, not each other.`
- `Development preview`
- The disabled `Open FactFight` button

## Lint result

Pass.

```text
> eslint .
Exit code: 0
```

The final lint run completed with no warnings or errors.

## TypeScript result

Pass.

```text
> tsc --noEmit
Exit code: 0
```

Strict TypeScript checking is enabled. The `@/*` alias maps to `./src/*`.

## Production build result

Pass.

```text
> next build
Next.js 16.2.10 (Turbopack)
Compiled successfully
Route /: static prerender
Exit code: 0
```

Next.js initially warned that the root Expo lockfile could be selected in the multi-project repository. `next.config.ts` now scopes Turbopack to the current `factfight-web` working directory. The final production build completed without that warning.

## Foundation validation

- App Router uses `src/app/`.
- The root layout contains the requested FactFight title and description metadata.
- Tailwind CSS is active through the PostCSS configuration and global stylesheet.
- All required FactFight color, radius, and spacing variables exist in `src/styles/tokens.css` and are imported globally.
- The temporary `/` page uses semantic `header`, `main`, `section`, `article`, list, button, and `footer` elements.
- The layout has mobile and desktop responsive states.
- Global `:focus-visible` styling is present.
- Cards use the 12 px token radius, subtle borders, and no heavy shadows.
- Display weights are primarily 400 and 500.
- No React Native or Expo imports exist in `src/`.
- No API calls or Supabase initialization exist in `src/`.
- No service-role key, OpenAI key, or secret-like value exists in `src/`.

## Scope confirmation

Confirmed: every workspace change reported by Git is under `factfight-web/`.

The following areas were not modified:

- `app/`
- `components/`
- `services/`
- `context/`
- `hooks/`
- `backend/`
- `supabase/`
- `client/landing/`
- Root `package.json`
- Root lockfile

No SQL was run. `supabase/sql/052_single_write_path_phase4_HOLD_DO_NOT_RUN.sql` was neither changed nor executed. No DNS or production deployment action occurred.

## Remaining warnings

`npm audit` reports two moderate entries representing one transitive PostCSS advisory (`GHSA-qx2v-qp2m-jg93`) under the current latest `next@16.2.10`. There are no high or critical findings. npm currently proposes a breaking and invalid-for-this-scaffold downgrade to `next@9.3.3`, so no automatic `npm audit fix --force` was applied.

This advisory should be rechecked when a patched Next.js release updates its bundled PostCSS version. It does not block the requested lint, TypeScript, production build, or static homepage smoke checks.

## Exact localhost command

From any PowerShell directory, run:

```powershell
npm.cmd --prefix C:\FactLens\factfight-web run dev
```

Then open `http://localhost:3000`.
