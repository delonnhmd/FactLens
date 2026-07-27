# FactFight first-claim onboarding report

Date: 2026-07-26

Status: implementation complete and released.

## Scope

Added a dismissible, localized three-step onboarding popup for newly signed-up users and a one-time congratulations moment after a user's first successful claim. The implementation is JavaScript/TypeScript only. No native dependency, app configuration, backend endpoint, database column, SQL migration, or Supabase schema change was added.

## Behavior

- Supported locale prefixes are `en`, `vi`, `zh`, and `es`; all other locales default to English.
- Mobile reads the device locale with React Native built-ins (`NativeModules`/`Platform`) and uses the existing AsyncStorage dependency.
- Web reads `navigator.language` and uses `localStorage`.
- Onboarding is marked per user ID when it opens, so logging out and back in does not show it again.
- The signup flow carries `onboarding=1` through the web confirmation callback and immediate-session redirect.
- The first-claim check counts the author's claims before insertion. If that count cannot be read, the congratulations moment is skipped rather than guessed.
- First-claim congratulations is keyed by user ID and claim ID, and is removed from the URL after dismissal.
- Mobile sharing uses the native `Share` API. Web sharing uses `navigator.share` with a clipboard fallback.

## Files added

- `constants/onboardingStrings.ts`
- `utils/detectUserLanguage.ts`
- `utils/onboardingStorage.ts`
- `components/onboarding/FirstClaimOnboardingGate.tsx`
- `components/onboarding/FirstClaimCongratulationsModal.tsx`
- `factfight-web/src/components/onboarding/first-claim-onboarding.tsx`
- `factfight-web/src/components/claims/first-claim-celebration.tsx`
- `factfight-web/src/lib/utils/detect-user-language.ts`
- `factfight-web/src/lib/utils/onboarding-strings.ts`
- `factfight-web/src/lib/utils/onboarding.test.ts`
- `factfight-web/FIRST_CLAIM_ONBOARDING_REPORT.md`

The web project is intentionally isolated from the Expo project by Next/Turbopack. Its local pure locale mapper and static copy mirror the root mobile shared source so neither app imports another app's runtime tree.

## Files changed

- Mobile auth, root layout, claim context/service, create screen, and claim detail route.
- Web signup/callback/confirmation/resend actions, feed, create action, claim detail page, and claim-language mapper.
- Existing web auth-flow test expectations were updated for the onboarding callback parameter.

## Database and backend

No new column or flag is needed. Tracking is per-device/account in AsyncStorage and localStorage. No migration SQL was written or run, and no backend endpoint was changed.

## Verification completed

Passing checks:

```text
root: npm.cmd run typecheck
web:  npm.cmd test              (9 files, 56 tests)
web:  npm.cmd run lint
web:  npm.cmd run typecheck
web:  npm.cmd run build
```

The localization test covers English, Vietnamese, Chinese, Spanish, and unsupported French fallback, plus complete copy for all four languages. The production web build includes `/feed`, `/create`, `/claim/[id]`, and `/auth/callback` with the new query-driven flow.

Real device language changes, a real new-account signup, first claim submission, second claim suppression, and native/browser share sheets still require manual device/browser verification after release.

## Release

The live EAS channel is `production`, serving runtime `1.0.0` on Android and iOS. Because this change is JS/TS-only, it does not require an EAS rebuild. Publish after the commit is pushed with:

```powershell
CI=1 npx eas update --channel production --environment production --message "Localized first-claim onboarding and congratulations" --non-interactive
```

The web app deploys through the existing Vercel Git integration after the push. No DNS or production backend action is required.

Release evidence:

- Git commit: `382697082b43e359508c38610ca4fd861b9fa32f`
- `origin/main` matches that commit.
- EAS production update group: `c4ab6538-4c4b-42fa-a0d7-201eaebb28cd` (Android and iOS, runtime `1.0.0`).
- Vercel production deployment for project `factfight/fact-lens`: Ready; `https://fact-lens-26jg5tfop-factfight.vercel.app`.
- `https://factfight.com` currently redirects to the canonical `https://www.factfight.com/`, which returned HTTP 200 from Vercel.
