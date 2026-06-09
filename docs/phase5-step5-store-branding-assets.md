# Phase 5 Step 5 - Store Branding Assets

## App Identity

App name: Verifact

Primary slogan: The red. The blue. The truth.

Positioning tagline: Community-powered claim verification.

Short positioning:
Verifact helps people review claims together using sources, evidence, community voting, and AI-assisted source checks.

Support contact:
support@verifact.pennyfloat.com

Website:
https://verifact.pennyfloat.com

## Store Short Description

The red. The blue. The truth. Community-powered claim verification with evidence, voting, and AI-assisted source checks.

## Store Long Description

Verifact is a community-powered claim verification app built for people who want to slow down rumors and review sources more carefully.

Post a claim, attach a source, and let the community help evaluate it. Verifact supports claim feeds, source review, True/Fake/Not sure voting, evidence links, contributor reputation, and AI-assisted source checks.

What you can do with Verifact:

- Post claims with source links.
- Review source quality and source-support signals.
- Vote True, Fake, or Not sure.
- Add evidence that supports, challenges, or adds context.
- See contributor reputation, badges, and ranks.
- Report unsafe, spammy, misleading, or abusive content.

AI in Verifact is preliminary. It can help read source pages and summarize whether a source appears to support a claim, but it does not decide final truth. Community voting, evidence, moderation, and source review all matter.

Verifact results are informational and may be incorrect. Always check original sources before making important decisions.

## Keywords

fact checking, claims, verification, evidence, source check, community voting, media literacy, news review

## Screenshot Set

Prepare these screenshots for iPhone and Android:

1. Claim Feed
   - Show a clean feed card with category, source quality, AI strip, and vote buttons.
   - Suggested caption: Review claims with the community.

2. Claim Detail
   - Show claim title, description, source link, vote results, and final/community status.
   - Suggested caption: See the full verification context.

3. AI and Source Support
   - Show AI risk signal and source-support section.
   - Suggested caption: AI-assisted source checks, not final truth.

4. Evidence Section
   - Show evidence list and Add Evidence form.
   - Suggested caption: Add sources that support or challenge a claim.

5. Reputation Profile
   - Show rank, reputation points, badges, and contribution stats.
   - Suggested caption: Build trust through reliable contributions.

6. Reporting and Safety
   - Show report button or moderation-safe reporting state.
   - Suggested caption: Report unsafe or misleading content.

## Compliance Checklist

- Privacy Policy URL: https://verifact.pennyfloat.com/privacy
- Terms URL: https://verifact.pennyfloat.com/terms
- Community Guidelines URL: https://verifact.pennyfloat.com/community-guidelines
- AI Disclaimer URL: https://verifact.pennyfloat.com/ai-disclaimer
- Support email: support@verifact.pennyfloat.com
- Account deletion: available in Profile settings.
- Reporting: available for claims, evidence, and profiles.
- Moderation: hidden content controls and admin review queue exist.
- AI disclaimer: AI checks are preliminary and informational.

## Build Commands

Static landing page:

```bash
npm run landing:build
```

Expo OTA update:

```bash
npx eas-cli update --branch preview --message "phase 5 step 5 store assets"
```

Production builds:

```bash
npx eas build -p android --profile production
npx eas build -p ios --profile production
```

## Remaining Manual Store Work

- Capture final screenshots from the actual app on iPhone and Android.
- Upload icons and screenshots in App Store Connect and Google Play Console.
- Confirm production Privacy Policy page is live at the chosen public URL.
- Rename or relink the EAS project so project ID `d3b9498f-a0d4-435c-81f5-e7b9b0d35d80` accepts slug `verifact` before production rebuilds.
- Confirm Apple developer account and Google Play account metadata.
