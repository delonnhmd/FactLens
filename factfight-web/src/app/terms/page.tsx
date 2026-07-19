import type { Metadata } from "next";

import { LegalPage } from "@/components/navigation/legal-page";

export const metadata: Metadata = { title: "Terms of use | FactFight", description: "Terms of Use governing use of FactFight, operated by MD Media LLC." };

export default function TermsPage() {
  return (
    <LegalPage effective="Last updated July 18, 2026 · Operated by MD Media LLC (Houston, Texas)" title="Terms of use">
      <section>
        <h2>1. Acceptance of these terms</h2>
        <p>{`By creating an account, logging in, or otherwise using FactFight (the "Service"), whether through our mobile application or website at factfight.com, you agree to these Terms of Use ("Terms"). If you do not agree, do not use the Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization.`}</p>
        <p className="mt-3">{`You must be at least 13 years old to use FactFight.`}</p>
      </section>
      <section>
        <h2>2. What FactFight is — and is not</h2>
        <p>{`FactFight is a platform that allows users to post claims, submit evidence, vote, and participate in community verification of statements, including statements about political and public matters. FactFight provides tools for users to evaluate claims collectively, assisted by automated analysis.`}</p>
        <p className="mt-3">{`FactFight is not a publisher, journalist, or arbiter of truth. FactFight does not author claims. Claims, evidence, comments, and votes are created and submitted by users. Verdicts, scores, and labels displayed on the Service are the automated and aggregated output of community voting and AI-assisted analysis — they are informational only, may be incorrect, and do not represent statements of fact, opinion, or endorsement by FactFight or MD Media LLC.`}</p>
      </section>
      <section>
        <h2>3. User-generated content and Section 230</h2>
        <p>{`The Service hosts content provided by users. Under Section 230 of the Communications Decency Act (47 U.S.C. § 230), FactFight is a provider of an interactive computer service and is not the publisher or speaker of user-provided content. You — not FactFight — are solely responsible for the claims, evidence, and other content you submit.`}</p>
        <p className="mt-3">{`FactFight does not endorse, guarantee, or assume responsibility for any user content. Any reliance you place on claims or verdicts is at your own risk.`}</p>
      </section>
      <section>
        <h2>4. Verdicts, scores, and accuracy — disclaimer</h2>
        <p>{`Verdicts (including labels such as "True," "Fake," "Disputed," or similar), source-quality scores, accuracy scores, and AI-generated analysis are produced by a combination of community voting and automated systems. These outputs:`}</p>
        <ul className="mt-3">
          <li>{`May be inaccurate, incomplete, outdated, or wrong;`}</li>
          <li>{`Are not professional, legal, financial, medical, or journalistic advice;`}</li>
          <li>{`Are not statements of fact by FactFight;`}</li>
          <li>{`Should never be relied upon as the sole basis for any decision.`}</li>
        </ul>
        <p className="mt-3">{`Always consult original sources and qualified professionals. FactFight expressly disclaims liability for any action taken in reliance on any verdict, score, or content on the Service.`}</p>
      </section>
      <section>
        <h2>5. Prohibited content and conduct — zero tolerance</h2>
        <p>{`FactFight has zero tolerance for objectionable content and abusive users. You may not post, and you may not use the Service to distribute, content that:`}</p>
        <ul className="mt-3">
          <li>{`Constitutes harassment, threats, incitement to violence, or hate speech;`}</li>
          <li>{`Is defamatory, libelous, or knowingly false about an identifiable person;`}</li>
          <li>{`Is sexually explicit, or exploits or endangers minors;`}</li>
          <li>{`Infringes intellectual property or privacy rights;`}</li>
          <li>{`Constitutes spam, fraud, impersonation, or manipulation of votes or verdicts;`}</li>
          <li>{`Violates any applicable law, including election, campaign-finance, and defamation law.`}</li>
        </ul>
        <p className="mt-3">{`FactFight reviews reported content and acts on violations within 24 hours, including removing content and terminating accounts. FactFight may remove any content or suspend or terminate any account at its sole discretion.`}</p>
      </section>
      <section>
        <h2>6. Integrity of the service</h2>
        <p>{`You may not: operate multiple accounts to influence outcomes; use bots or automated means to vote or post; fabricate sources or evidence; manipulate reputation, scores, or verdicts; or interfere with the Service's operation. Violations are grounds for immediate termination.`}</p>
      </section>
      <section>
        <h2>7. Your content — license and responsibility</h2>
        <p>{`You retain ownership of content you submit. You grant FactFight a worldwide, non-exclusive, royalty-free license to host, display, reproduce, and distribute your content in connection with operating and promoting the Service.`}</p>
        <p className="mt-3">{`Claims become part of the public record. You may delete a claim within three (3) hours of posting. After three hours, or once a verdict is finalized, claims are permanent and may not be deleted. If you delete your account, your personal information is removed but your public contributions remain, attributed to an anonymous user.`}</p>
        <p className="mt-3">{`You represent that you have all rights necessary to submit your content and that it does not violate these Terms or any law.`}</p>
      </section>
      <section>
        <h2>8. Indemnification</h2>
        <p>{`You agree to indemnify, defend, and hold harmless FactFight, MD Media LLC, and their officers, members, employees, and agents from any claims, damages, liabilities, losses, and expenses (including reasonable attorneys' fees) arising from: (a) your content; (b) your use of the Service; (c) your violation of these Terms; or (d) your violation of any law or third-party right.`}</p>
      </section>
      <section>
        <h2>9. Disclaimer of warranties</h2>
        <p>{`THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. FACTFIGHT DOES NOT WARRANT THAT THE SERVICE OR ANY VERDICT WILL BE ACCURATE, UNINTERRUPTED, OR ERROR-FREE.`}</p>
      </section>
      <section>
        <h2>10. Limitation of liability</h2>
        <p>{`TO THE MAXIMUM EXTENT PERMITTED BY LAW, FACTFIGHT AND MD MEDIA LLC WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).`}</p>
      </section>
      <section>
        <h2>11. Dispute resolution and arbitration</h2>
        <p>{`Any dispute arising from these Terms or the Service will be resolved by binding individual arbitration administered by the American Arbitration Association (AAA) under its applicable Consumer Arbitration Rules, seated in Houston, Texas. You and FactFight waive any right to a jury trial or to participate in a class action, except where prohibited by law.`}</p>
      </section>
      <section>
        <h2>12. Governing law</h2>
        <p>{`These Terms are governed by the laws of the State of Texas, without regard to conflict-of-laws principles.`}</p>
      </section>
      <section>
        <h2>13. DMCA / copyright</h2>
        <p>{`FactFight responds to notices of alleged copyright infringement under the Digital Millennium Copyright Act. To submit a notice, contact our designated agent at `}<a href="mailto:support@factfight.com">support@factfight.com</a>{`.`}</p>
      </section>
      <section>
        <h2>14. Changes to these terms</h2>
        <p>{`We may update these Terms. Material changes will be communicated through the Service. Continued use after changes constitutes acceptance.`}</p>
      </section>
      <section>
        <h2>15. Termination</h2>
        <p>{`We may suspend or terminate your access at any time, with or without notice, for any violation of these Terms or for any reason at our discretion.`}</p>
      </section>
      <section>
        <h2>16. Contact</h2>
        <p>{`Questions about these terms may be sent to `}<a href="mailto:support@factfight.com">support@factfight.com</a>{`. MD Media LLC, Houston, Texas.`}</p>
      </section>
    </LegalPage>
  );
}
