import type { Metadata } from "next";

import { LegalPage } from "@/components/navigation/legal-page";

export const metadata: Metadata = { title: "Privacy policy | FactFight", description: "How FactFight, operated by MD Media LLC, handles account and community data." };

export default function PrivacyPage() {
  return (
    <LegalPage effective="Last updated July 18, 2026 · Operated by MD Media LLC (Houston, Texas)" title="Privacy policy">
      <section>
        <p>{`FactFight is a community-powered claim verification service, available through our mobile application and website at factfight.com, operated by MD Media LLC ("FactFight," "we," "us"). This policy explains how we collect, use, store, share, and protect information for accounts, claims, evidence, voting, reports, moderation, and AI-assisted analysis.`}</p>
        <p className="mt-3"><strong>{`We do not sell your personal information.`}</strong></p>
      </section>
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li>{`Account information: email address, username, display name, avatar, authentication identifiers, and account status.`}</li>
          <li>{`User-generated content: claim text, source URLs, uploaded images and their metadata, evidence notes, votes, reports, and comments.`}</li>
          <li>{`Moderation, safety, reputation, and trust signals: report status, visibility status, vote history, badges, and account-action records.`}</li>
          <li>{`Technical information: IP-derived network data, device or browser details, app version, diagnostics, cookies, local storage, and service logs.`}</li>
        </ul>
      </section>
      <section>
        <h2>2. How we use information</h2>
        <ul>
          <li>{`To create and authenticate accounts, maintain profiles and reputation, provide support, and process account-deletion requests.`}</li>
          <li>{`To publish and operate claims, evidence, images, votes, reports, and public contributor pages.`}</li>
          <li>{`To run moderation and safety systems, investigate abuse, enforce policies, prevent spam and fraud, and protect service integrity.`}</li>
          <li>{`To operate diagnostics, reliability monitoring, security checks, and product improvements.`}</li>
        </ul>
        <p className="mt-3">{`We do not use your personal information for third-party advertising, and we do not sell it.`}</p>
      </section>
      <section>
        <h2>3. AI-assisted analysis</h2>
        <p>{`We use AI-assisted systems (including OpenAI) to classify, summarize, moderate, and evaluate claims, source URLs, uploaded evidence, and related context, and to detect prohibited content. To do this, we may send claim text, source URLs, and related content to our AI provider for processing. AI outputs are preliminary risk signals that may be wrong, incomplete, outdated, or biased, and never make the final community verdict.`}</p>
      </section>
      <section>
        <h2>4. Service providers (sub-processors)</h2>
        <p>{`We share information with a limited set of service providers that process it only to provide services to us, under confidentiality and security obligations, and not for their own marketing or resale:`}</p>
        <ul className="mt-3">
          <li>{`Supabase — authentication, database, and file storage.`}</li>
          <li>{`Render — backend and API hosting.`}</li>
          <li>{`Vercel — website hosting.`}</li>
          <li>{`OpenAI — AI-assisted analysis and content moderation.`}</li>
          <li>{`Resend — transactional and account email delivery.`}</li>
          <li>{`Expo, Apple, and Google — mobile app delivery and distribution.`}</li>
        </ul>
      </section>
      <section>
        <h2>5. Legal requests and disclosures</h2>
        <p>{`We do not sell your personal information. However, we may disclose information when required to do so by valid legal process — including a lawful court order, subpoena, or government request — or where we believe in good faith that disclosure is necessary to comply with the law, protect the rights, property, or safety of FactFight, our users, or the public, or to prevent imminent harm. In responding to any such request, we disclose only the information legally required and no more. Where permitted by law, we will make reasonable efforts to notify the affected user before disclosing their information, unless we are legally prohibited from doing so or the request relates to an emergency.`}</p>
      </section>
      <section>
        <h2>6. Your privacy rights</h2>
        <p>{`Depending on where you live, you may have rights over your personal information, including the rights to access, correct, delete, or receive a copy of it, and to object to or restrict certain processing.`}</p>
        <p className="mt-3">{`California (CCPA/CPRA): You have the right to know what personal information we collect, to access and delete it, and to opt out of the sale or sharing of personal information. We do not sell or share your personal information as those terms are defined under California law. We will not discriminate against you for exercising your rights.`}</p>
        <p className="mt-3">{`EEA/UK (GDPR): You have the rights of access, rectification, erasure, restriction, portability, and objection, and the right to lodge a complaint with your data protection authority. We process personal information to provide the service, to comply with law, and for our legitimate interests in safety, security, and integrity.`}</p>
        <p className="mt-3">{`To exercise any right, contact `}<a href="mailto:support@factfight.com">support@factfight.com</a>{` from the email address associated with your account. We may need to verify your identity before acting on a request.`}</p>
      </section>
      <section>
        <h2>7. Data retention</h2>
        <p>{`We retain personal information for as long as needed to operate the service, comply with law, resolve disputes, prevent abuse, and preserve verification history. Public contributions such as claims, evidence, and votes may be retained in anonymized form after account deletion to preserve the integrity of the verification record.`}</p>
      </section>
      <section>
        <h2>8. Account deletion</h2>
        <p>{`You may request account deletion from within the app or by contacting `}<a href="mailto:support@factfight.com">support@factfight.com</a>{` from the email address associated with your account. When you delete your account, your personal information is removed, but your public contributions may remain, attributed to an anonymous user, to preserve verification history. Some records may be retained or anonymized when needed for safety, legal compliance, fraud prevention, or dispute resolution.`}</p>
      </section>
      <section>
        <h2>9. Children&apos;s privacy</h2>
        <p>{`FactFight is not directed to children under 13, and you must be at least 13 years old to use it. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will delete it. If you believe a child under 13 has provided us information, contact `}<a href="mailto:support@factfight.com">support@factfight.com</a>{`.`}</p>
      </section>
      <section>
        <h2>10. Public content</h2>
        <p>{`Claims, evidence, votes, usernames, public profile details, and reputation signals may be visible to other users when submitted to public or community-facing features. Do not submit private personal information in public claims or evidence.`}</p>
      </section>
      <section>
        <h2>11. Changes to this policy</h2>
        <p>{`We may update this policy. Material changes will be communicated through the Service. Continued use after changes constitutes acceptance.`}</p>
      </section>
      <section>
        <h2>12. Contact</h2>
        <p>{`For privacy questions, requests, or to exercise your rights, contact `}<a href="mailto:support@factfight.com">support@factfight.com</a>{`. MD Media LLC, Houston, Texas.`}</p>
      </section>
    </LegalPage>
  );
}
