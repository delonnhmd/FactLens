# PHASE 5 STEP 2

## Soft Launch Positioning

Verifact should be described as an informational community news-verification app.
Do not claim that AI or community voting guarantees truth.

## Store Copy

Short description:
The red. The blue. The truth. Verifact helps people review news claims with community voting, evidence links, source checks, and AI risk signals.

Long description:
Verifact is a community-driven news verification app where users post claims, add source evidence, vote, and review AI pre-check signals. AI may be incorrect and does not decide final truth. Community voting and evidence review are informational tools, not professional advice.

## Required Store Fields

- Privacy URL: use the existing public Privacy Policy page.
- Support email: add the production support email before store submission.
- App icon: confirm final square icon renders clearly at small sizes.
- Splash screen: confirm no misleading claims about AI accuracy.
- Screenshots: show Home feed, Claim Detail, Evidence, Profile, and Leaderboard.

## Launch Safety Checklist

- Users can report claims, evidence, and profiles.
- Users can delete their account.
- Users can sign out and sign back in.
- AI disclaimer is visible in app.
- Terms and Community Guidelines are visible in app.
- Claims use labels such as Community Reviewing, AI Preliminary Review, Needs More Evidence, and Finalized by Community Consensus.
- Raw backend errors and secrets are not shown to users.

## Remaining Manual Checks

- Verify Render has the existing `FACTLENS_ADMIN_API_KEY` admin secret configured.
- Verify admin report endpoints are reachable only with the admin key.
- Verify Supabase RLS still blocks unauthorized report edits.
