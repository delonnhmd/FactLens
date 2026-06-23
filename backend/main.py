# PHASE 4 STEP 1
# PHASE 4 STEP 2
# PHASE 4 STEP 3
# PHASE 4 STEP 4
# PHASE 4 STEP 5
# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
# PHASE 4 STEP 5F-2
# PHASE 4 STEP 7
# PHASE 4 STEP 8
# PHASE 4 STEP 9
# PHASE 4 STEP 10
# PHASE 4 STEP 17
# PHASE 4 STEP 18
# PHASE 4 STEP 27
import json
import os
import re
import sys
from io import BytesIO
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from time import monotonic
from typing import Any, Literal
from urllib.parse import quote, urlparse
from urllib.request import Request as UrlRequest, urlopen
from uuid import UUID

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

try:
    from services.openai_factcheck import (
        analyze_claim_with_openai,
        get_openai_model,
    )
    from services.ai_library_loader import load_verifact_ai_library
    from services.source_page_fetcher import fetch_source_page
    from services.source_credibility import score_source_url
except ModuleNotFoundError:  # Allows repo-root command: uvicorn backend.main:app
    from backend.services.openai_factcheck import (
        analyze_claim_with_openai,
        get_openai_model,
    )
    from backend.services.ai_library_loader import load_verifact_ai_library
    from backend.services.source_page_fetcher import fetch_source_page
    from backend.services.source_credibility import score_source_url


load_dotenv()
# PHASE 4 STEP 27
app = FastAPI(title="Verifact backend", docs_url=None, redoc_url=None, openapi_url=None)

PUBLIC_SITE_URL = "https://verifact.pennyfloat.com"
FALLBACK_SUPABASE_URL = "https://islcxqkevxxopatqvlqz.supabase.co"
FALLBACK_SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbGN4cWtldnh4b3BhdHF2bHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDE5ODksImV4cCI6MjA5NTMxNzk4OX0."
    "96zZEPyRz2_RLkKJTx1GJIzQ-E1EcGA1X82FLPohTlg"
)
SUPABASE_PUBLIC_URL = (
    os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    or os.environ.get("SUPABASE_URL")
    or FALLBACK_SUPABASE_URL
).rstrip("/")
SUPABASE_PUBLIC_ANON_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or FALLBACK_SUPABASE_ANON_KEY

AUTH_CALLBACK_HTML = """
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Verifact email verification callback." />
    <title>Verifact Email Verification</title>
    <style>
      :root {
        --ink: #172033;
        --muted: #667085;
        --border: #e4e7ec;
        --surface: #ffffff;
        --soft: #f5f7fa;
        --navy: #0d1b3e;
        --danger: #e24b4a;
        --danger-soft: #fcebeb;
        --success-soft: #e1f5ee;
      }

      * {
        box-sizing: border-box;
      }

      body {
        align-items: center;
        background: var(--soft);
        color: var(--ink);
        display: flex;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        line-height: 1.5;
        margin: 0;
        min-height: 100vh;
        padding: 20px;
      }

      main {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        max-width: 480px;
        padding: 28px;
        text-align: center;
        width: 100%;
      }

      .mark {
        align-items: center;
        background: var(--success-soft);
        border-radius: 999px;
        color: var(--navy);
        display: inline-flex;
        font-size: 28px;
        font-weight: 800;
        height: 68px;
        justify-content: center;
        margin-bottom: 18px;
        width: 68px;
      }

      main[data-state="error"] .mark {
        background: var(--danger-soft);
        color: var(--danger);
      }

      h1 {
        color: var(--navy);
        font-size: 24px;
        letter-spacing: 0;
        line-height: 1.2;
        margin: 0 0 10px;
      }

      p {
        color: var(--muted);
        font-size: 15px;
        margin: 0 0 18px;
      }

      .actions {
        display: grid;
        gap: 10px;
      }

      a {
        align-items: center;
        border-radius: 8px;
        display: inline-flex;
        font-size: 14px;
        font-weight: 800;
        justify-content: center;
        min-height: 46px;
        padding: 11px 14px;
        text-decoration: none;
      }

      .primary {
        background: var(--navy);
        color: #ffffff;
      }

      .secondary {
        background: #ffffff;
        border: 1px solid var(--border);
        color: var(--navy);
      }

      .small {
        color: #98a2b3;
        font-size: 12px;
        margin: 16px 0 0;
      }
    </style>
  </head>
  <body>
    <main id="card" data-state="success">
      <div id="mark" class="mark">OK</div>
      <h1 id="title">Email verified successfully</h1>
      <p id="copy">Your account has been verified. You may now close this page and return to the Verifact app to sign in.</p>
    </main>
    <script>
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(search.replace(/^\\?/, ""));
      const error =
        hashParams.get("error_description") ||
        searchParams.get("error_description") ||
        hashParams.get("error") ||
        searchParams.get("error") ||
        "";
      const card = document.getElementById("card");
      const mark = document.getElementById("mark");
      const title = document.getElementById("title");
      const copy = document.getElementById("copy");

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", error ? "/auth/callback" : "/auth/confirmed");
      }

      if (error) {
        card.dataset.state = "error";
        mark.textContent = "!";
        title.textContent = "Verification link problem";
        copy.textContent = "This verification link could not be used. Request a new verification email from the Verifact app and try again.";
      }
    </script>
  </body>
</html>
"""

RESET_PASSWORD_HTML = """
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="Reset your Verifact password." />
    <title>Reset your password | Verifact</title>
    <style>
      :root {
        --ink: #172033;
        --muted: #667085;
        --border: #e4e7ec;
        --surface: #ffffff;
        --soft: #f5f7fa;
        --navy: #0d1b3e;
        --danger: #e24b4a;
        --success: #1d9e75;
        --success-soft: #e1f5ee;
      }

      * {
        box-sizing: border-box;
      }

      body {
        align-items: center;
        background:
          radial-gradient(circle at top left, rgba(29, 158, 117, 0.12), transparent 28%),
          linear-gradient(180deg, #ffffff 0%, var(--soft) 100%);
        color: var(--ink);
        display: flex;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        line-height: 1.5;
        margin: 0;
        min-height: 100vh;
        padding: 20px;
      }

      main {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 18px;
        max-width: 480px;
        padding: 28px;
        width: 100%;
      }

      .brand {
        align-items: center;
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }

      .mark {
        align-items: center;
        background: var(--navy);
        border-radius: 12px;
        color: #ffffff;
        display: flex;
        font-size: 15px;
        font-weight: 800;
        height: 42px;
        justify-content: center;
        width: 42px;
      }

      .brand-name {
        color: var(--navy);
        font-size: 21px;
        font-weight: 800;
        line-height: 1.1;
      }

      .brand-line {
        color: var(--muted);
        font-size: 13px;
        margin-top: 2px;
      }

      h1 {
        color: var(--navy);
        font-size: 26px;
        letter-spacing: 0;
        line-height: 1.2;
        margin: 0 0 10px;
      }

      p {
        color: var(--muted);
        font-size: 15px;
        margin: 0 0 18px;
      }

      form {
        display: grid;
        gap: 14px;
      }

      label {
        color: var(--ink);
        display: grid;
        font-size: 13px;
        font-weight: 800;
        gap: 7px;
      }

      input {
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--ink);
        font: inherit;
        min-height: 48px;
        padding: 11px 12px;
        width: 100%;
      }

      input:focus {
        border-color: var(--navy);
        outline: 3px solid rgba(13, 27, 62, 0.12);
      }

      button,
      a.button {
        align-items: center;
        background: var(--navy);
        border: 0;
        border-radius: 8px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        justify-content: center;
        min-height: 48px;
        padding: 12px 16px;
        text-decoration: none;
      }

      button:disabled {
        background: #98a2b3;
        cursor: not-allowed;
      }

      .feedback {
        border-radius: 10px;
        display: none;
        font-size: 14px;
        font-weight: 700;
        margin: 18px 0 0;
        padding: 12px;
      }

      .feedback[data-kind="error"],
      .feedback[data-kind="success"] {
        display: block;
      }

      .feedback[data-kind="error"] {
        background: #fcebeb;
        color: var(--danger);
      }

      .feedback[data-kind="success"] {
        background: var(--success-soft);
        color: var(--success);
      }

      .success-actions {
        display: none;
        margin-top: 18px;
      }

      main[data-state="success"] .success-actions {
        display: grid;
      }

      main[data-state="success"] form,
      main[data-state="invalid"] form {
        display: none;
      }
    </style>
  </head>
  <body>
    <main id="card" data-state="loading">
      <div class="brand" aria-label="Verifact">
        <div class="mark">V</div>
        <div>
          <div class="brand-name">Verifact</div>
          <div class="brand-line">The red. The blue. The truth.</div>
        </div>
      </div>

      <h1>Reset your password</h1>
      <p id="intro">Enter a new password for your Verifact account.</p>

      <form id="reset-form" hidden>
        <label>
          New password
          <input id="new-password" type="password" autocomplete="new-password" minlength="8" required />
        </label>

        <label>
          Confirm password
          <input id="confirm-password" type="password" autocomplete="new-password" minlength="8" required />
        </label>

        <button id="submit-button" type="submit">Update password</button>
      </form>

      <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
      const SUPABASE_URL = __SUPABASE_PUBLIC_URL__;
      const SUPABASE_ANON_KEY = __SUPABASE_PUBLIC_ANON_KEY__;
      const card = document.getElementById("card");
      const form = document.getElementById("reset-form");
      const feedback = document.getElementById("feedback");
      const intro = document.getElementById("intro");
      const newPassword = document.getElementById("new-password");
      const confirmPassword = document.getElementById("confirm-password");
      const submitButton = document.getElementById("submit-button");

      function setFeedback(message, kind) {
        feedback.textContent = message;
        feedback.dataset.kind = kind;
      }

      function showInvalidLink() {
        card.dataset.state = "invalid";
        intro.textContent = "This reset link could not be used. Request a new password reset email from Verifact and try again.";
        setFeedback("We could not verify this reset link. Please request a new password reset email.", "error");
      }

      async function initializeResetSession() {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token") || "";
        const refreshToken = hashParams.get("refresh_token") || "";
        const type = hashParams.get("type") || "";

        if (!accessToken || !refreshToken || type !== "recovery") {
          showInvalidLink();
          return;
        }

        if (!window.supabase || !window.supabase.createClient) {
          card.dataset.state = "invalid";
          setFeedback("Password reset is temporarily unavailable. Please try again.", "error");
          return;
        }

        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        let sessionResult;

        try {
          sessionResult = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch {
          showInvalidLink();
          return;
        }

        if (sessionResult.error) {
          showInvalidLink();
          return;
        }

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "/reset-password");
        }

        card.dataset.state = "ready";
        form.hidden = false;

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          setFeedback("", "");

          const nextPassword = newPassword.value;
          const confirmedPassword = confirmPassword.value;

          if (nextPassword.length < 8) {
            setFeedback("Password must be at least 8 characters.", "error");
            return;
          }

          if (nextPassword !== confirmedPassword) {
            setFeedback("Passwords must match.", "error");
            return;
          }

          submitButton.disabled = true;
          submitButton.textContent = "Updating...";

          try {
            const { error: updateError } = await supabaseClient.auth.updateUser({ password: nextPassword });

            if (updateError) {
              setFeedback("We could not update your password. Please try again.", "error");
              return;
            }
          } catch {
            setFeedback("We could not update your password. Please try again.", "error");
            return;
          } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Update password";
          }

          card.dataset.state = "success";
          intro.textContent = "";
          setFeedback("Password updated successfully. You can now return to the Verifact app to sign in.", "success");
        });
      }

      initializeResetSession();
    </script>
  </body>
</html>
""".replace("__SUPABASE_PUBLIC_URL__", json.dumps(SUPABASE_PUBLIC_URL)).replace(
    "__SUPABASE_PUBLIC_ANON_KEY__",
    json.dumps(SUPABASE_PUBLIC_ANON_KEY),
)

LEGAL_PAGE_STYLE = """
  :root {
    --ink: #172033;
    --muted: #667085;
    --border: #e4e7ec;
    --surface: #ffffff;
    --soft: #f5f7fa;
    --navy: #0d1b3e;
    --blue: #185fa5;
  }

  * {
    box-sizing: border-box;
  }

  body {
    background: var(--soft);
    color: var(--ink);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
    margin: 0;
  }

  .page {
    margin: 0 auto;
    max-width: 850px;
    min-height: 100vh;
    padding: 28px 20px 44px;
  }

  header,
  footer {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
  }

  .brand {
    color: var(--navy);
    font-size: 20px;
    font-weight: 800;
    text-decoration: none;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  a {
    color: var(--blue);
    font-weight: 700;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  main {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    margin: 28px 0;
    padding: 28px;
  }

  h1 {
    color: var(--navy);
    font-size: clamp(32px, 8vw, 48px);
    letter-spacing: 0;
    line-height: 1.05;
    margin: 0 0 10px;
  }

  h2 {
    color: var(--navy);
    font-size: 20px;
    margin: 30px 0 10px;
  }

  p,
  li {
    color: var(--muted);
    font-size: 15px;
  }

  ul {
    padding-left: 22px;
  }

  .updated {
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
    margin-top: 0;
  }

  footer {
    color: var(--muted);
    font-size: 14px;
  }

  @media (max-width: 560px) {
    .page {
      padding: 20px 14px 36px;
    }

    main {
      border-radius: 10px;
      padding: 22px;
    }

    header,
    footer {
      align-items: flex-start;
      flex-direction: column;
    }
  }
"""


def build_legal_page(title: str, description: str, content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <meta name="description" content="{description}" />
    <title>{title} | Verifact</title>
    <style>{LEGAL_PAGE_STYLE}</style>
  </head>
  <body>
    <div class="page">
      <header>
        <a class="brand" href="/">Verifact</a>
        <nav aria-label="Legal pages">
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
          <a href="/personal-privacy">Personal Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/copyright">Copyright</a>
          <a href="/community-guidelines">Guidelines</a>
        </nav>
      </header>
      <main>
        {content}
      </main>
      <footer>
        <span>&copy; 2026 PennyFloat</span>
        <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a>
      </footer>
    </div>
  </body>
</html>"""


ABOUT_PAGE_STYLE = """
  :root {
    --navy: #0d1b3e;
    --navy-2: #12306f;
    --surface: #ffffff;
    --soft: #f5f7fa;
    --ink: #172033;
    --muted: #667085;
    --border: #e4e7ec;
    --green: #1d9e75;
    --red: #e24b4a;
    --amber: #ef9f27;
    --purple: #534ab7;
  }

  * {
    box-sizing: border-box;
  }

  body {
    background: var(--soft);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
    margin: 0;
  }

  a {
    color: inherit;
  }

  .hero {
    background: linear-gradient(135deg, var(--navy), var(--navy-2));
    color: #ffffff;
    padding: 34px 20px 42px;
  }

  .container {
    margin: 0 auto;
    max-width: 850px;
    width: 100%;
  }

  .nav {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: space-between;
    margin-bottom: 44px;
  }

  .brand {
    color: #ffffff;
    font-size: 22px;
    font-weight: 700;
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .nav-links a {
    color: #dbe7ff;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }

  .nav-links a:hover {
    color: #ffffff;
    text-decoration: underline;
  }

  .badge {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 999px;
    color: #e7eefc;
    display: inline-flex;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 18px;
    padding: 7px 12px;
  }

  h1 {
    color: #ffffff;
    font-size: clamp(42px, 10vw, 72px);
    letter-spacing: 0;
    line-height: 0.95;
    margin: 0 0 12px;
  }

  .slogan {
    color: #ffffff;
    font-size: clamp(22px, 6vw, 34px);
    font-weight: 700;
    line-height: 1.15;
    margin: 0 0 16px;
  }

  .intro {
    color: #dbe7ff;
    font-size: 18px;
    margin: 0;
    max-width: 720px;
  }

  main {
    padding: 34px 20px 0;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    margin-bottom: 18px;
    padding: 24px;
  }

  h2 {
    color: var(--navy);
    font-size: 24px;
    line-height: 1.2;
    margin: 0 0 10px;
  }

  p {
    color: var(--muted);
    font-size: 16px;
    margin: 0 0 14px;
  }

  p:last-child {
    margin-bottom: 0;
  }

  ul {
    margin: 0;
    padding-left: 22px;
  }

  li {
    color: var(--muted);
    font-size: 16px;
    margin: 8px 0;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .pill {
    border-radius: 999px;
    color: #ffffff;
    display: inline-flex;
    font-size: 13px;
    font-weight: 700;
    padding: 6px 10px;
  }

  .green {
    background: var(--green);
  }

  .red {
    background: var(--red);
  }

  .amber {
    background: var(--amber);
  }

  .purple {
    background: var(--purple);
  }

  .contact {
    background: #eef4ff;
    border-color: #d8e4ff;
  }

  .contact a {
    color: var(--navy);
    font-weight: 700;
  }

  footer {
    color: var(--muted);
    font-size: 14px;
    margin: 28px auto 0;
    max-width: 850px;
    padding: 22px 20px 34px;
  }

  @media (max-width: 560px) {
    .hero {
      padding-top: 24px;
    }

    .nav {
      align-items: flex-start;
      flex-direction: column;
      margin-bottom: 34px;
    }

    main {
      padding-top: 24px;
    }

    .card {
      border-radius: 12px;
      padding: 20px;
    }
  }
"""


ABOUT_PAGE_HTML = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <meta
      name="description"
      content="About Verifact, a community-powered claim verification app with AI-assisted source review and community voting."
    />
    <title>About Verifact | The red. The blue. The truth.</title>
    <style>{ABOUT_PAGE_STYLE}</style>
  </head>
  <body>
    <header class="hero">
      <div class="container">
        <nav class="nav" aria-label="Verifact pages">
          <a class="brand" href="/">Verifact</a>
          <div class="nav-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/copyright">Copyright</a>
            <a href="/community-guidelines">Guidelines</a>
          </div>
        </nav>
        <span class="badge">Owned and operated by PennyFloat</span>
        <h1>About Verifact</h1>
        <p class="slogan">The red. The blue. The truth.</p>
        <p class="intro">Verifact is a community-powered claim verification app built to help people review claims, sources, and evidence with more transparency.</p>
      </div>
    </header>

    <main>
      <div class="container">
        <section class="card">
          <h2>What Verifact is</h2>
          <p>Verifact helps users submit claims, review source links, add evidence, and vote on whether a claim appears True, Fake, or Not Sure.</p>
          <p>The product is designed for community-powered claim verification. It is not an official fact-checking authority, and it does not promise guaranteed truth.</p>
        </section>

        <section class="card">
          <h2>How the review process works</h2>
          <ul>
            <li>Users submit claims with source links or context.</li>
            <li>Community members can add evidence and review what supports or challenges a claim.</li>
            <li>AI-assisted source review can help summarize source quality and risk signals.</li>
            <li>AI does not make the final decision. Human and community voting remains the deciding signal in Verifact's review flow.</li>
          </ul>
          <div class="pill-row" aria-label="Verifact review signals">
            <span class="pill green">True</span>
            <span class="pill red">Fake</span>
            <span class="pill amber">Not Sure</span>
            <span class="pill purple">AI-assisted review</span>
          </div>
        </section>

        <section class="card">
          <h2>Neutral by design</h2>
          <p>Verifact is built for political neutrality. The same rules apply to claims from any person, party, organization, source, or viewpoint.</p>
          <p>The goal is to make the review process more transparent: show the claim, show the evidence, show the source context, and let the community participate.</p>
        </section>

        <section class="card contact">
          <h2>Contact</h2>
          <p>Verifact is owned and operated by PennyFloat.</p>
          <p>For support, app review questions, or public page requests, contact <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a>.</p>
        </section>
      </div>
    </main>

    <footer>
      <div class="container">&copy; 2026 PennyFloat</div>
    </footer>
  </body>
</html>"""


PRIVACY_POLICY_HTML = build_legal_page(
    "Verifact Privacy Policy",
    "Privacy Policy for Verifact by PennyFloat.",
    """
        <h1>Privacy Policy</h1>
        <p class="updated">Effective June 10, 2026</p>
        <p>Verifact is a community-powered claim verification app operated by PennyFloat. This policy explains how Verifact collects, uses, stores, and protects information for accounts, claims, evidence, voting, reports, moderation, and AI-assisted analysis.</p>
        <p>Verifact does not sell personal data.</p>

        <h2>Information We Collect</h2>
        <ul>
          <li>Account information such as email address, username, display name, authentication identifiers, profile details, and account status.</li>
          <li>Uploaded images, image metadata, claim text, source URLs, evidence notes, votes, reports, and other user-generated submissions.</li>
          <li>Moderation, safety, reputation, and trust signals such as report status, visibility status, vote history, badges, and account action records.</li>
          <li>Technical information such as IP-derived network data, device or browser details, app version, diagnostics, cookies, local storage, and service logs.</li>
        </ul>

        <h2>How We Use Information</h2>
        <ul>
          <li>To create accounts, authenticate users, provide support, and process account deletion requests.</li>
          <li>To publish and operate claims, evidence, images, votes, reports, and public contributor surfaces.</li>
          <li>To run moderation systems, investigate abuse, enforce policies, prevent spam, and protect service integrity.</li>
          <li>To operate analytics, diagnostics, reliability monitoring, security checks, and product improvements.</li>
        </ul>

        <h2>AI-Assisted Analysis</h2>
        <p>Verifact may use AI-assisted systems to classify, summarize, and evaluate claims, source URLs, uploaded evidence, and related context. AI outputs are preliminary and may be wrong, incomplete, outdated, or biased. They do not guarantee that a claim is true or false.</p>

        <h2>Third-Party Services</h2>
        <p>Verifact may use Supabase for authentication, database, and storage services; Render for backend hosting; image storage for uploaded files; Expo, Apple, and Google for app delivery; and analytics, logging, email, security, and moderation tools as needed to operate the service.</p>

        <h2>Public Content and Retention</h2>
        <p>Claims, evidence, votes, reports, public profile details, and reputation signals may be visible to other users depending on the feature and moderation state. We retain information as needed to operate Verifact, comply with law, resolve disputes, enforce rules, prevent abuse, and maintain security.</p>

        <h2>Account Deletion</h2>
        <p>You may request account deletion from the app or by contacting support@pennyfloat.com from the email address associated with your account. Some records may be retained or anonymized when needed for safety, legal compliance, fraud prevention, dispute resolution, or verification history.</p>

        <h2>Contact</h2>
        <p>For privacy questions, support, or account deletion requests, contact <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a>.</p>
    """,
)

PERSONAL_PRIVACY_HTML = build_legal_page(
    "Verifact Personal Privacy",
    "Personal privacy promise for Verifact by PennyFloat.",
    """
        <h1>Personal Privacy</h1>
        <p class="updated">Effective June 11, 2026</p>
        <p>Verifact and PennyFloat take personal user privacy seriously. We do not sell, rent, trade, or voluntarily provide personal user information to unrelated third parties for marketing, advertising, data brokerage, or commercial resale.</p>

        <h2>Our Privacy Promise</h2>
        <p>We will not provide personal user information to a third party unless a limited exception applies. Limited exceptions include a valid court order, subpoena, warrant, legally binding government request, regulatory requirement, user consent, or a situation where disclosure is necessary to protect users, investigate abuse, prevent fraud, secure the service, or comply with applicable law.</p>

        <h2>Service Providers</h2>
        <p>Verifact may use trusted service providers such as hosting, authentication, storage, analytics, security, email, and app delivery providers to operate the service. These providers may process limited information only as needed to provide services to Verifact. They are not allowed to use personal user information for their own marketing or resale.</p>

        <h2>Legal Requests</h2>
        <p>If PennyFloat receives a legal demand for user information, we review the request before responding. Where allowed by law and practical under the circumstances, we may narrow, challenge, or reject requests that appear invalid, overbroad, or inconsistent with user privacy.</p>

        <h2>Public Content</h2>
        <p>Claims, evidence, votes, reports, usernames, profile details, and reputation signals may be visible inside Verifact when users submit them to public or community-facing features. This page does not make public submissions private.</p>

        <h2>Contact</h2>
        <p>Questions about personal privacy may be sent to <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a>.</p>
    """,
)

TERMS_OF_SERVICE_HTML = build_legal_page(
    "Verifact Terms of Service",
    "Terms of Service for Verifact by PennyFloat.",
    """
        <h1>Terms of Service</h1>
        <p class="updated">Effective June 10, 2026</p>
        <p>These Terms govern your access to and use of Verifact, a claim and evidence review product operated by PennyFloat. Verifact is built around a simple standard: The red. The blue. The truth.</p>

        <h2>Acceptable Use</h2>
        <p>You may use Verifact only for lawful, honest, and respectful participation in claim review. You are responsible for claims, evidence, images, reports, votes, comments, profile information, and other content you submit.</p>

        <h2>User-Generated Content</h2>
        <p>You retain ownership of your content, subject to rights held by others. By submitting content, you grant PennyFloat a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, analyze, moderate, format, and distribute that content as needed to operate and protect Verifact.</p>

        <h2>No Guarantee of Accuracy</h2>
        <p>Verifact provides tools for reviewing claims and evidence, but it does not guarantee factual accuracy, completeness, neutrality, timeliness, or final truth. Content may be disputed, incomplete, outdated, misleading, or incorrect. Always verify important information independently.</p>

        <h2>AI-Assisted Analysis</h2>
        <p>AI-assisted analysis may help classify, summarize, or evaluate claims and evidence. AI outputs can be wrong, incomplete, biased, or misapplied, and they are not legal, medical, financial, election, safety, or other professional advice.</p>

        <h2>Prohibited Behavior</h2>
        <ul>
          <li>Harassment, threats, bullying, doxxing, exploitation, or abuse.</li>
          <li>Hate speech, explicit content, illegal content, or promotion of violence or self-harm.</li>
          <li>Spam, scams, malicious links, coordinated manipulation, fake engagement, or deceptive behavior.</li>
          <li>Impersonation of people, organizations, public officials, platforms, moderators, or PennyFloat staff.</li>
          <li>Uploading content that violates privacy, confidentiality, or intellectual property rights.</li>
          <li>Scraping, bulk downloading, reverse engineering, credential stuffing, API abuse, rate-limit evasion, or attempts to interfere with service operations.</li>
        </ul>

        <h2>Moderation and Account Actions</h2>
        <p>PennyFloat may review, label, limit, hide, remove, preserve, or escalate content, and may suspend or terminate accounts, when needed to enforce these Terms, protect users, comply with law, investigate abuse, or maintain service integrity.</p>

        <h2>Intellectual Property</h2>
        <p>Verifact, PennyFloat, product names, logos, software, interfaces, workflows, analysis systems, and original content are owned by PennyFloat or its licensors. These Terms do not grant ownership of Verifact or PennyFloat intellectual property.</p>

        <h2>Liability Limitation</h2>
        <p>To the fullest extent permitted by law, PennyFloat is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost data, service interruption, reputational harm, or reliance on user-generated or AI-assisted content.</p>

        <h2>Contact</h2>
        <p>Questions about these Terms may be sent to <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a>.</p>
    """,
)

COPYRIGHT_NOTICE_HTML = build_legal_page(
    "Verifact Copyright Notice",
    "Copyright notice and intellectual property policy for Verifact by PennyFloat.",
    """
        <h1>Copyright Notice</h1>
        <p class="updated">Effective June 10, 2026</p>
        <p>&copy; 2026 PennyFloat. All rights reserved.</p>

        <h2>Verifact Ownership</h2>
        <p>Verifact, including its name, product experience, software, interface designs, workflows, analysis systems, documentation, and original PennyFloat content, is owned by PennyFloat or its licensors and protected by intellectual property laws.</p>

        <h2>User-Generated Content Licensing</h2>
        <p>You retain ownership of content you submit to Verifact, including claims, evidence, images, comments, reports, and related materials, subject to rights held by third parties. By submitting content, you grant PennyFloat a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, analyze, moderate, format, and distribute that content as needed to operate, protect, and improve Verifact.</p>

        <h2>Your Responsibility</h2>
        <p>You are responsible for ensuring that your submissions do not infringe copyrights, trademarks, privacy rights, publicity rights, confidentiality obligations, or other rights. Do not upload screenshots, articles, images, videos, documents, or other materials unless you have the right to share them.</p>

        <h2>DMCA and Copyright Contact Process</h2>
        <p>If you believe content on Verifact infringes your copyright, contact <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a> with your name, contact email, a description of the copyrighted work, the location of the allegedly infringing content, and a statement that you believe the use is unauthorized.</p>

        <h2>Repeat Infringement and Abuse</h2>
        <p>PennyFloat may remove or restrict content and may suspend or terminate accounts that repeatedly infringe intellectual property rights or misuse the copyright reporting process.</p>

        <h2>AI Analysis Disclaimer</h2>
        <p>AI-assisted analysis may process user-generated content to classify, summarize, or compare claims and evidence. AI analysis does not create a legal determination of ownership, infringement, fair use, authorization, or factual accuracy.</p>
    """,
)

COMMUNITY_GUIDELINES_HTML = build_legal_page(
    "Verifact Community Guidelines",
    "Community Guidelines for Verifact by PennyFloat.",
    """
        <h1>Community Guidelines</h1>
        <p class="updated">Effective June 10, 2026</p>
        <p>These Community Guidelines keep Verifact focused on useful claim and evidence review. They apply to claims, evidence, images, reports, votes, usernames, profiles, and any other user-submitted content.</p>

        <h2>Respectful Discussion</h2>
        <p>Discuss claims, evidence, and reasoning without attacking people. Strong disagreement is allowed; harassment, threats, intimidation, and targeted abuse are not.</p>

        <h2>Not Allowed</h2>
        <ul>
          <li>Harassment, threats, bullying, doxxing, exploitation, or coordinated abuse.</li>
          <li>Explicit sexual content, exploitative content, illegal content, graphic violence for shock value, or content that promotes self-harm or violence.</li>
          <li>Hate speech or attacks based on race, ethnicity, national origin, religion, sex, gender identity, sexual orientation, disability, age, caste, or veteran status.</li>
          <li>Spam, scams, malware, malicious links, repetitive content, fake engagement, or coordinated manipulation.</li>
          <li>Impersonation of another person, organization, public official, platform, moderator, or PennyFloat representative.</li>
        </ul>

        <h2>Evidence Quality Expectations</h2>
        <p>Submit evidence that is relevant to the claim, clearly sourced when possible, and not intentionally misleading. Avoid cropped, edited, or out-of-context media unless you clearly explain the edit or context.</p>

        <h2>Moderation Actions</h2>
        <p>Content may be removed for policy violations. Verifact may also reduce visibility, add labels, limit features, preserve records, suspend accounts, or report serious issues when content violates these Guidelines, Terms, platform rules, or applicable law.</p>

        <h2>Contact</h2>
        <p>Questions or reports may be sent to <a href="mailto:support@pennyfloat.com">support@pennyfloat.com</a>.</p>
    """,
)

PUBLIC_SITE_URL = os.environ.get("VERIFACT_PUBLIC_SITE_URL", "https://verifact.pennyfloat.com").rstrip("/")
VERIFACT_APP_STORE_URL = os.environ.get("VERIFACT_APP_STORE_URL", "").strip()
VERIFACT_GOOGLE_PLAY_URL = os.environ.get("VERIFACT_GOOGLE_PLAY_URL", "").strip()
VERIFACT_DEFAULT_OG_IMAGE_URL = f"{PUBLIC_SITE_URL}/assets/icon/icon.png"

CLAIM_PAGE_STYLE = """
  :root {
    --bg: #08111f;
    --panel: #0f1b2d;
    --panel-strong: #14253d;
    --ink: #f6f8fb;
    --muted: #aeb9c9;
    --soft: #d8e0ec;
    --border: rgba(255, 255, 255, 0.12);
    --blue: #5ea2ff;
    --red: #ff6b6b;
    --green: #33d39f;
    --gold: #f6c65b;
    --shadow: rgba(0, 0, 0, 0.35);
  }

  * {
    box-sizing: border-box;
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
    margin: 0;
  }

  a {
    color: inherit;
  }

  .page {
    margin: 0 auto;
    max-width: 800px;
    min-height: 100vh;
    padding: 24px 18px 44px;
    width: 100%;
  }

  .topbar,
  .footer {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
  }

  .brand {
    align-items: center;
    color: var(--ink);
    display: inline-flex;
    font-size: 19px;
    font-weight: 850;
    gap: 10px;
    text-decoration: none;
  }

  .mark {
    align-items: center;
    background: var(--ink);
    border-radius: 8px;
    color: var(--bg);
    display: inline-flex;
    font-size: 12px;
    font-weight: 900;
    height: 30px;
    justify-content: center;
    width: 30px;
  }

  .slogan-small {
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
  }

  .hero,
  .card,
  .download-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 18px 48px var(--shadow);
  }

  .hero {
    margin-top: 24px;
    overflow: hidden;
  }

  .hero-inner {
    padding: 28px;
  }

  .eyebrow-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 18px;
  }

  .eyebrow {
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--soft);
    display: inline-flex;
    font-size: 12px;
    font-weight: 850;
    line-height: 1;
    padding: 8px 10px;
  }

  h1 {
    color: var(--ink);
    font-size: clamp(32px, 8vw, 56px);
    letter-spacing: 0;
    line-height: 1.02;
    margin: 0;
  }

  .description {
    color: var(--soft);
    font-size: 17px;
    margin: 16px 0 0;
  }

  .claim-image {
    background: #050a13;
    display: block;
    max-height: 430px;
    object-fit: cover;
    width: 100%;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 22px;
  }

  .button,
  .download-button {
    align-items: center;
    border-radius: 10px;
    display: inline-flex;
    font-size: 14px;
    font-weight: 850;
    justify-content: center;
    min-height: 46px;
    padding: 12px 15px;
    text-decoration: none;
  }

  .button.primary {
    background: var(--ink);
    color: var(--bg);
  }

  .button.secondary,
  .download-button {
    background: var(--panel-strong);
    border: 1px solid var(--border);
    color: var(--ink);
  }

  .grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 14px;
  }

  .stat {
    background: var(--panel-strong);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 15px;
  }

  .stat span {
    color: var(--muted);
    display: block;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 4px;
  }

  .stat strong {
    color: var(--ink);
    display: block;
    font-size: 24px;
    line-height: 1;
  }

  .bar {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    height: 8px;
    margin-top: 10px;
    overflow: hidden;
  }

  .bar-fill {
    border-radius: inherit;
    display: block;
    height: 100%;
    min-width: 3px;
  }

  .true {
    background: var(--green);
  }

  .fake {
    background: var(--red);
  }

  .unsure {
    background: var(--gold);
  }

  .content {
    display: grid;
    gap: 14px;
    margin-top: 14px;
  }

  .card,
  .download-card {
    padding: 22px;
  }

  h2 {
    color: var(--ink);
    font-size: 18px;
    letter-spacing: 0;
    line-height: 1.25;
    margin: 0 0 10px;
  }

  p {
    color: var(--muted);
    font-size: 15px;
    margin: 0;
  }

  .source-link {
    color: var(--blue);
    display: inline-flex;
    font-weight: 850;
    margin-top: 10px;
    overflow-wrap: anywhere;
    text-decoration: none;
  }

  .source-link:hover {
    text-decoration: underline;
  }

  .downloads {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 16px;
  }

  .download-button.disabled {
    color: var(--muted);
  }

  .tagline {
    color: var(--ink);
    font-size: 20px;
    font-weight: 900;
    margin-top: 18px;
  }

  .footer {
    color: var(--muted);
    font-size: 13px;
    margin-top: 22px;
  }

  @media (max-width: 640px) {
    .page {
      padding: 18px 12px 34px;
    }

    .hero,
    .card,
    .download-card {
      border-radius: 14px;
    }

    .hero-inner,
    .card,
    .download-card {
      padding: 20px;
    }

    .actions,
    .downloads,
    .grid {
      grid-template-columns: 1fr;
    }

    .button,
    .download-button {
      width: 100%;
    }
  }
"""


def compact_text(value: object, fallback: str = "") -> str:
    text = fallback if value is None else str(value)
    return " ".join(text.split())


def html_attr(value: object, fallback: str = "") -> str:
    text = compact_text(value, fallback)
    return escape(" ".join(text.split()), quote=True)


def html_body(value: object, fallback: str = "") -> str:
    return escape(compact_text(value, fallback), quote=False)


def truncate_text(value: str, max_length: int) -> str:
    if len(value) <= max_length:
        return value

    return value[: max_length - 3].rstrip() + "..."


def to_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def format_count(value: object) -> str:
    return f"{to_int(value):,}"


def normalize_public_url(url: object) -> str:
    value = str(url or "").strip()

    if not value:
        return ""

    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return value

    if value.startswith("/"):
        return f"{PUBLIC_SITE_URL}{value}"

    return f"https://{value}"


def get_url_host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "Source").removeprefix("www.")
    except Exception:
        return "Source"


def get_claim_image_url(claim: dict) -> str:
    for key in ("image_url", "thumbnail_url"):
        image_url = normalize_public_url(claim.get(key))
        if image_url:
            return image_url

    return ""


def get_claim_meta_description(claim: dict) -> str:
    description = compact_text(claim.get("description"), "Review this claim on Verifact.")
    return truncate_text(description, 180)


def get_vote_percent(count: int, total: int) -> str:
    if total <= 0:
        return "0"

    return str(round((count / total) * 100, 1))


def is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except ValueError:
        return False


def build_download_button(label: str, url: str) -> str:
    if url:
        return f'<a class="download-button" href="{html_attr(url)}" rel="noopener noreferrer" target="_blank">{html_body(label)}</a>'

    return f'<span class="download-button disabled" aria-disabled="true">{html_body(label)} - Coming soon</span>'


def build_vote_stat(label: str, count: int, total: int, color_class: str) -> str:
    return f"""
            <div class="stat">
              <span>{html_body(label)}</span>
              <strong>{format_count(count)}</strong>
              <div class="bar" aria-hidden="true"><span class="bar-fill {color_class}" style="width: {get_vote_percent(count, total)}%"></span></div>
            </div>"""


def build_public_claim_page(claim: dict) -> str:
    claim_id = str(claim.get("id") or "")
    encoded_claim_id = quote(claim_id, safe="")
    title = html_body(claim.get("title"), "Verifact claim")
    meta_title = truncate_text(compact_text(claim.get("title"), "Verifact claim"), 95)
    description = html_body(claim.get("description"), "No description provided.")
    meta_description = get_claim_meta_description(claim)
    category = html_body(claim.get("category"), "Other")
    ai_summary = html_body(
        claim.get("ai_summary") or claim.get("source_support_summary") or claim.get("ai_reason"),
        "AI review is still pending. Community voting and evidence are still available.",
    )
    source_url = normalize_public_url(claim.get("source_url"))
    source_host = html_body(get_url_host(source_url))
    source_link = ""
    if source_url:
        source_link = f'<a class="source-link" href="{html_attr(source_url)}" rel="noopener noreferrer" target="_blank">{source_host}</a>'

    votes_true = to_int(claim.get("votes_true"))
    votes_fake = to_int(claim.get("votes_fake"))
    votes_unsure = to_int(claim.get("votes_unsure"))
    total_votes = to_int(claim.get("total_votes")) or votes_true + votes_fake + votes_unsure
    image_url = get_claim_image_url(claim)
    og_image_url = image_url or VERIFACT_DEFAULT_OG_IMAGE_URL
    public_url = f"{PUBLIC_SITE_URL}/claim/{encoded_claim_id}"
    app_url = f"verifact://claim/{encoded_claim_id}"
    image_html = ""
    if image_url:
        image_html = f'<img class="claim-image" src="{html_attr(image_url)}" alt="Image for this Verifact claim" loading="lazy" />'

    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <meta name="description" content="{html_attr(meta_description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Verifact" />
    <meta property="og:url" content="{html_attr(public_url)}" />
    <meta property="og:title" content="{html_attr(meta_title)}" />
    <meta property="og:description" content="{html_attr(meta_description)}" />
    <meta property="og:image" content="{html_attr(og_image_url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{html_attr(meta_title)}" />
    <meta name="twitter:description" content="{html_attr(meta_description)}" />
    <meta name="twitter:image" content="{html_attr(og_image_url)}" />
    <title>{title} | Verifact</title>
    <style>{CLAIM_PAGE_STYLE}</style>
  </head>
  <body>
    <div class="page">
      <header class="topbar">
        <a class="brand" href="/"><span class="mark">VF</span><span>Verifact</span></a>
        <span class="slogan-small">The red. The blue. The truth.</span>
      </header>

      <main>
        <article class="hero">
          {image_html}
          <div class="hero-inner">
            <div class="eyebrow-row">
              <span class="eyebrow">{category}</span>
              <span class="eyebrow">{format_count(total_votes)} total votes</span>
            </div>
            <h1>{title}</h1>
            <p class="description">{description}</p>
            <div class="actions">
              <a class="button primary" href="{html_attr(app_url)}">Open in Verifact App</a>
              <a class="button secondary" href="#download">Download Verifact</a>
            </div>
          </div>
        </article>

        <section class="grid" aria-label="Vote totals">
          {build_vote_stat("True", votes_true, total_votes, "true")}
          {build_vote_stat("Fake", votes_fake, total_votes, "fake")}
          {build_vote_stat("Not sure", votes_unsure, total_votes, "unsure")}
        </section>

        <div class="content">
          <section class="card">
            <h2>AI Summary</h2>
            <p>{ai_summary}</p>
          </section>

          <section class="card">
            <h2>Source</h2>
            <p>Review the original source connected to this claim.</p>
            {source_link}
          </section>

          <section id="download" class="download-card">
            <h2>Download Verifact</h2>
            <p>Read the claim on web or open it in the app when Verifact is installed.</p>
            <div class="downloads" aria-label="Download Verifact">
              {build_download_button("App Store", VERIFACT_APP_STORE_URL)}
              {build_download_button("Google Play", VERIFACT_GOOGLE_PLAY_URL)}
            </div>
            <p class="tagline">The red. The blue. The truth.</p>
          </section>
        </div>
      </main>

      <footer class="footer">
        <span>&copy; 2026 PennyFloat</span>
        <a href="/privacy">Privacy</a>
      </footer>
    </div>
  </body>
</html>"""


def build_public_claim_404_page() -> str:
    description = "This Verifact claim could not be found or is no longer public."
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="{description}" />
    <meta property="og:title" content="Claim not found | Verifact" />
    <meta property="og:description" content="{description}" />
    <meta property="og:image" content="{html_attr(VERIFACT_DEFAULT_OG_IMAGE_URL)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>Claim not found | Verifact</title>
    <style>{CLAIM_PAGE_STYLE}</style>
  </head>
  <body>
    <div class="page">
      <header class="topbar">
        <a class="brand" href="/"><span class="mark">VF</span><span>Verifact</span></a>
        <span class="slogan-small">The red. The blue. The truth.</span>
      </header>
      <main>
        <section class="hero">
          <div class="hero-inner">
            <div class="eyebrow-row"><span class="eyebrow">404</span></div>
            <h1>Claim not found</h1>
            <p class="description">{description}</p>
            <div class="actions">
              <a class="button primary" href="/">Go to Verifact</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>"""


def build_public_claim_error_page() -> str:
    description = "Verifact could not load this claim page right now. Please try again later."
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="{description}" />
    <meta property="og:title" content="Claim temporarily unavailable | Verifact" />
    <meta property="og:description" content="{description}" />
    <meta property="og:image" content="{html_attr(VERIFACT_DEFAULT_OG_IMAGE_URL)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>Claim temporarily unavailable | Verifact</title>
    <style>{CLAIM_PAGE_STYLE}</style>
  </head>
  <body>
    <div class="page">
      <header class="topbar">
        <a class="brand" href="/"><span class="mark">VF</span><span>Verifact</span></a>
        <span class="slogan-small">The red. The blue. The truth.</span>
      </header>
      <main>
        <section class="hero">
          <div class="hero-inner">
            <div class="eyebrow-row"><span class="eyebrow">Unavailable</span></div>
            <h1>Claim temporarily unavailable</h1>
            <p class="description">{description}</p>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>"""


def fetch_public_claim_row(claim_id: str) -> dict | None:
    supabase = get_supabase_client()
    response = supabase.table("claims").select("*").eq("id", claim_id).limit(1).execute()
    rows = response.data or []

    if isinstance(rows, dict):
        return rows

    if not rows:
        return None

    return rows[0]

# PHASE 4 STEP 20
# PHASE 4 STEP 20C
ALLOWED_SOURCE_QUALITIES = {
    "official",
    "mainstream",
    "specialized",
    "social",
    "blog",
    "unknown",
}


# PHASE 4 STEP 20C
def normalize_source_quality(value):
    if value is None:
        return "unknown"

    normalized_value = str(value).strip().lower()

    if normalized_value in ALLOWED_SOURCE_QUALITIES:
        return normalized_value

    return "unknown"


# PHASE 5 STEP 1B
RANK_ORDER = [
    "New Scout",
    "Claim Checker",
    "Trusted Verifier",
    "Source Hunter",
    "Verifact Guardian",
]


def calculate_trust_tier(trust_score):
    score = max(0, min(100, float(trust_score or 50)))
    if score >= 75:
        return "HIGH_TRUST"
    if score >= 55:
        return "TRUSTED"
    if score >= 30:
        return "BASIC"
    return "LOW_TRUST"


def calculate_rank_title(trust_score):
    score = max(0, min(100, float(trust_score or 50)))
    if score >= 90:
        return "Verifact Guardian"
    if score >= 75:
        return "Source Hunter"
    if score >= 55:
        return "Trusted Verifier"
    if score >= 30:
        return "Claim Checker"
    return "New Scout"


def calculate_vote_weight(trust_tier):
    weights = {
        "LOW_TRUST": 0.75,
        "BASIC": 1.0,
        "TRUSTED": 1.2,
        "HIGH_TRUST": 1.4,
    }
    return weights.get(str(trust_tier or "BASIC").upper(), 1.0)


def resolve_display_rank(current_rank, highest_rank_achieved):
    current_index = RANK_ORDER.index(current_rank) if current_rank in RANK_ORDER else 0
    highest_index = RANK_ORDER.index(highest_rank_achieved) if highest_rank_achieved in RANK_ORDER else 0
    return RANK_ORDER[max(current_index, highest_index)]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


ClaimType = Literal["FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"]
AiStatus = Literal[
    "PENDING",
    "LOW_RISK",
    "MEDIUM_RISK",
    "HIGH_RISK",
    "NEEDS_MORE_EVIDENCE",
    "NOT_FACT_CHECKABLE",
    "ERROR",
]


# PHASE 4 STEP 27
AI_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
AI_RATE_LIMIT_MAX_REQUESTS = 30
AI_CLAIM_COOLDOWN_SECONDS = 45
SOURCE_SCORE_RATE_LIMIT_MAX_REQUESTS = 120
RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}
CLAIM_AI_COOLDOWNS: dict[str, float] = {}

RESERVED_USERNAME_MESSAGE = (
    "This username is reserved. If you represent this person or organization, "
    "please apply for verification."
)
IDENTITY_ADMIN_ROLES = {"SUPER_ADMIN", "ADMIN", "MODERATOR"}
ROLE_ASSIGNMENT_PERMISSIONS = {
    "SUPER_ADMIN": {"ADMIN", "MODERATOR"},
    "ADMIN": {"MODERATOR"},
    "MODERATOR": set(),
}
INITIAL_ADMIN_ROLES = {
    "md.noithat@gmail.com": "SUPER_ADMIN",
    "delonnhmd@gmail.com": "ADMIN",
    "minhducmediallc@gmail.com": "MODERATOR",
}
INITIAL_ADMIN_ROLES_SEEDED = False


# PHASE 4 STEP 27
def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or "unknown"

    return request.client.host if request.client else "unknown"


# PHASE 4 STEP 27
def enforce_rate_limit(request: Request, bucket: str, max_requests: int, window_seconds: int) -> None:
    now = monotonic()
    key = f"{bucket}:{get_client_ip(request)}"
    recent_requests = [
        timestamp
        for timestamp in RATE_LIMIT_BUCKETS.get(key, [])
        if now - timestamp < window_seconds
    ]

    if len(recent_requests) >= max_requests:
        print("[rate-limit] blocked:", bucket, get_client_ip(request), flush=True)
        raise HTTPException(status_code=429, detail="Too many actions. Please try again later.")

    recent_requests.append(now)
    RATE_LIMIT_BUCKETS[key] = recent_requests


# PHASE 4 STEP 27
def enforce_claim_ai_cooldown(claim_id: str) -> None:
    now = monotonic()
    last_request = CLAIM_AI_COOLDOWNS.get(claim_id)

    if last_request is not None and now - last_request < AI_CLAIM_COOLDOWN_SECONDS:
        print("[ai cooldown] blocked claim:", claim_id, flush=True)
        raise HTTPException(status_code=429, detail="AI pre-check was just run. Please try again later.")

    CLAIM_AI_COOLDOWNS[claim_id] = now


class AiPrecheckRequest(BaseModel):
    claim_id: str = ""
    title: str = ""
    description: str = ""
    source_url: str = ""
    category: str = ""


# PHASE 4 STEP 3
class AiPrecheckRetryRequest(BaseModel):
    claim_id: str = ""


# PHASE 5 STEP 1B
class AdminOverrideRequest(BaseModel):
    claim_id: str = ""
    new_status: str = ""
    reason: str = ""


# PHASE 5 STEP 2
class AdminReportActionRequest(BaseModel):
    status: str = "RESOLVED"
    admin_note: str = ""
    hide_target: bool = False


# PHASE 5 STEP 3
class AdminContentVisibilityRequest(BaseModel):
    target_type: str = "CLAIM"
    target_id: str = ""
    reason: str = ""


class AdminClaimActionRequest(BaseModel):
    claim_id: str = ""
    reason: str = ""
    featured: bool = True


class AdminUserActionRequest(BaseModel):
    user_id: str = ""
    reason: str = ""
    suspended: bool = True


class IdentityUsernameCheckRequest(BaseModel):
    username: str = ""


class VerificationRequestPayload(BaseModel):
    request_type: str = ""
    requested_name: str = ""
    official_email: str = ""
    official_website: str = ""
    social_links: list[Any] = []
    supporting_documents: list[Any] = []


class AdminVerificationDecisionRequest(BaseModel):
    decision_note: str = ""
    claimed_by_user_id: str | None = None


class AdminAssignRoleRequest(BaseModel):
    email: str = ""
    role: str = ""
    reason: str = ""


class ProfileEnsureRequest(BaseModel):
    username: str = ""
    display_name: str = ""


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    avatar_path: str | None = None
    bio: str | None = None
    profile_visibility: str | None = None


class AiPrecheckResponse(BaseModel):
    ok: bool
    claim_id: str
    # PHASE 4 STEP 7
    claim_type: ClaimType | None = None
    ai_confidence: float | None = None
    source_count: int | None = None
    source_quality: str | None = None
    # PHASE 4 STEP 9
    source_domain: str | None = None
    source_score: int | None = None
    source_reason: str | None = None
    # PHASE 4 STEP 21
    source_read_status: str | None = None
    source_page_title: str | None = None
    source_supports_claim: bool | None = None
    source_support_summary: str | None = None
    # PHASE 4 STEP 10
    evidence_used_count: int | None = None
    red_flags: list[str] | None = None
    ai_summary: str | None = None
    ai_status: AiStatus | None = None
    error: str | None = None
    # PHASE 4 STEP 5B
    details: str | None = None
    hint: str | None = None
    supabase_updated: bool | None = None
    updated_claim: dict | None = None


def normalize_profile_username_value(value: Any) -> str:
    return str(value or "").strip().lstrip("@").lower()


def is_valid_profile_username(value: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9_]{3,20}", value))


def get_metadata_username_values(user: dict) -> set[str]:
    metadata = user.get("user_metadata") or user.get("raw_user_meta_data") or {}

    if not isinstance(metadata, dict):
        metadata = {}

    values: set[str] = set()
    for key in ("username", "displayName", "display_name", "full_name", "name"):
        normalized_value = normalize_profile_username_value(metadata.get(key))

        if normalized_value:
            values.add(normalized_value)

    return values


def fetch_auth_users_for_username_check() -> list[dict]:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend.")

    users: list[dict] = []

    for page in range(1, 21):
        url = f"{supabase_url}/auth/v1/admin/users?page={page}&per_page=1000"
        request = UrlRequest(
            url,
            headers={
                "apikey": service_role_key,
                "authorization": f"Bearer {service_role_key}",
            },
        )

        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))

        page_users = payload.get("users") if isinstance(payload, dict) else payload

        if not isinstance(page_users, list) or not page_users:
            break

        users.extend([user for user in page_users if isinstance(user, dict)])

        if len(page_users) < 1000:
            break

    return users


def normalize_identity_key(value: Any) -> str:
    return re.sub(r"[\s_.-]+", "", str(value or "").strip().lower())


def normalize_admin_email(value: Any) -> str:
    return str(value or "").strip().lower()


def normalize_admin_role(value: Any) -> str:
    return str(value or "").strip().upper().replace(" ", "_")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_first_row(result: Any) -> dict | None:
    rows = getattr(result, "data", None) or []

    if isinstance(rows, dict):
        return rows

    return rows[0] if rows else None


def is_missing_column_error(error: Exception, column_names: list[str]) -> bool:
    message = str(error).lower()
    return (
        any(column.lower() in message for column in column_names)
        and ("column" in message or "schema cache" in message or "could not find" in message)
    )


def execute_reserved_query(query_builder, optional_columns: list[str] | None = None):
    try:
        return query_builder("active").execute()
    except Exception as active_error:
        if optional_columns and is_missing_column_error(active_error, optional_columns):
            return None
        if not is_missing_column_error(active_error, ["active"]):
            raise

    try:
        return query_builder("is_active").execute()
    except Exception as is_active_error:
        if optional_columns and is_missing_column_error(is_active_error, optional_columns):
            return None
        if not is_missing_column_error(is_active_error, ["is_active"]):
            raise

    try:
        return query_builder(None).execute()
    except Exception as error:
        if optional_columns and is_missing_column_error(error, optional_columns):
            return None
        raise


def find_reserved_row_by_key(supabase: Any, table_name: str, normalized_key: str) -> dict | None:
    def build_query(active_column: str | None):
        query = supabase.table(table_name).select("*").eq("normalized_key", normalized_key).limit(1)

        if active_column:
            query = query.eq(active_column, True)

        return query

    result = execute_reserved_query(build_query)
    return get_first_row(result) if result else None


def find_reserved_row_by_alias(supabase: Any, table_name: str, normalized_key: str) -> dict | None:
    for alias_column in ("aliases", "alias_keys", "normalized_aliases"):
        def build_query(active_column: str | None, column: str = alias_column):
            query = supabase.table(table_name).select("*").contains(column, [normalized_key]).limit(1)

            if active_column:
                query = query.eq(active_column, True)

            return query

        result = execute_reserved_query(build_query, optional_columns=[alias_column])
        row = get_first_row(result) if result else None

        if row:
            return row

    return None


def find_reserved_identity_match(value: Any) -> dict | None:
    normalized_key = normalize_identity_key(value)

    if not normalized_key:
        return None

    supabase = get_supabase_client()
    targets = (
        ("reserved_people", "PERSON"),
        ("reserved_brands", "BRAND"),
    )

    for table_name, reserved_type in targets:
        row = find_reserved_row_by_key(supabase, table_name, normalized_key)

        if not row:
            row = find_reserved_row_by_alias(supabase, table_name, normalized_key)

        if row:
            return {
                "type": reserved_type,
                "table": table_name,
                "normalized_key": normalized_key,
                "row": row,
            }

    return None


def build_reserved_username_check_response(username: str) -> dict:
    normalized_key = normalize_identity_key(username)
    match = find_reserved_identity_match(username)

    if match:
        return {
            "available": False,
            "reserved": True,
            "normalized_key": normalized_key,
            "message": RESERVED_USERNAME_MESSAGE,
        }

    return {
        "available": True,
        "reserved": False,
        "normalized_key": normalized_key,
    }


def check_username_availability_for_save(username: str, excluded_user_id: str = "") -> dict:
    normalized_username = normalize_profile_username_value(username)

    if not is_valid_profile_username(normalized_username):
        return {
            "ok": True,
            "available": False,
            "reserved": False,
            "normalized_username": normalized_username,
            "message": "Username must be 3-20 characters.",
        }

    reserved_check = build_reserved_username_check_response(normalized_username)

    if reserved_check.get("reserved"):
        return {
            "ok": True,
            "available": False,
            "reserved": True,
            "normalized_username": normalized_username,
            "message": RESERVED_USERNAME_MESSAGE,
        }

    supabase = get_supabase_client()
    profile_query = (
        supabase.table("profiles")
        .select("id")
        .eq("username_normalized", normalized_username)
        .limit(1)
    )

    if excluded_user_id:
        profile_query = profile_query.neq("id", excluded_user_id)

    profile_result = profile_query.execute()

    if profile_result.data:
        return {
            "ok": True,
            "available": False,
            "reserved": False,
            "normalized_username": normalized_username,
            "message": "Username is already taken",
        }

    for auth_user in fetch_auth_users_for_username_check():
        auth_user_id = str(auth_user.get("id") or "")

        if excluded_user_id and auth_user_id == excluded_user_id:
            continue

        if normalized_username in get_metadata_username_values(auth_user):
            return {
                "ok": True,
                "available": False,
                "reserved": False,
                "normalized_username": normalized_username,
                "message": "Username is already taken",
            }

    return {
        "ok": True,
        "available": True,
        "reserved": False,
        "normalized_username": normalized_username,
        "message": "Username available",
    }


def read_auth_user_metadata(auth_user: Any) -> dict:
    metadata = getattr(auth_user, "user_metadata", None) or getattr(auth_user, "raw_user_meta_data", None) or {}
    return metadata if isinstance(metadata, dict) else {}


def read_auth_user_metadata_string(auth_user: Any, key: str) -> str:
    value = read_auth_user_metadata(auth_user).get(key)
    return value.strip() if isinstance(value, str) and value.strip() else ""


def generate_backend_profile_slug(username: str, user_id: str) -> str:
    base_slug = re.sub(r"[^a-z0-9]+", "-", str(username or "").strip().lower()).strip("-")[:48] or "user"
    suffix = user_id.replace("-", "")[-6:].lower()
    return f"{base_slug}-{suffix}"[:48] if suffix else base_slug


def generate_backend_fallback_username(email: str, user_id: str) -> str:
    email_prefix = normalize_profile_username_value((email or "").split("@", 1)[0])

    if not is_valid_profile_username(email_prefix):
        email_prefix = "user"

    suffix = user_id.replace("-", "")[-6:].lower() or "000000"
    max_base_length = max(3, 20 - len(suffix) - 1)
    return f"{email_prefix[:max_base_length]}_{suffix}"[:20]


def get_backend_preferred_username(auth_user: Any) -> str:
    email = str(getattr(auth_user, "email", "") or "")
    user_id = str(getattr(auth_user, "id", "") or "")
    metadata_username = read_auth_user_metadata_string(auth_user, "username")
    email_prefix = email.split("@", 1)[0] if email else ""

    for value in (metadata_username, email_prefix, generate_backend_fallback_username(email, user_id)):
        normalized = normalize_profile_username_value(value)

        if is_valid_profile_username(normalized):
            return normalized

    return generate_backend_fallback_username(email, user_id)


def sanitize_backend_bio(value: str | None) -> str | None:
    if value is None:
        return None

    return re.sub(r"\s+", " ", value.replace("<", "").replace(">", "")).strip()[:160]


def normalize_backend_profile_visibility(value: str | None) -> str:
    return "private" if value == "private" else "public"


def is_valid_backend_avatar_url(value: str | None) -> bool:
    if value is None or not value.strip():
        return True

    parsed = urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def build_profile_response(row: dict | None) -> dict:
    return {"ok": True, "profile": row}


def fetch_profile_row(supabase: Any, user_id: str) -> dict | None:
    result = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    return get_first_row(result)


def get_authenticated_identity(request: Request) -> dict:
    authorization = request.headers.get("authorization", "")

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    access_token = authorization.split(" ", 1)[1].strip()

    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        auth_response = get_supabase_client().auth.get_user(access_token)
        auth_user = getattr(auth_response, "user", None)
    except Exception as error:
        print("[identity auth] token validation failed:", str(error), flush=True)
        raise HTTPException(status_code=401, detail="Authentication required.")

    user_id = str(getattr(auth_user, "id", "") or "")
    email = normalize_admin_email(getattr(auth_user, "email", "") or "")

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")

    return {
        "id": user_id,
        "email": email,
        "user": auth_user,
    }


def fetch_admin_user_by_email(supabase: Any, email: str) -> dict | None:
    result = (
        supabase.table("admin_users")
        .select("*")
        .eq("email", normalize_admin_email(email))
        .limit(1)
        .execute()
    )
    return get_first_row(result)


def insert_with_optional_columns(
    supabase: Any,
    table_name: str,
    payload: dict,
    optional_columns: set[str],
):
    try:
        return supabase.table(table_name).insert(payload).execute()
    except Exception as error:
        if not is_missing_column_error(error, list(optional_columns)):
            raise

    stripped_payload = {
        key: value
        for key, value in payload.items()
        if key not in optional_columns
    }
    return supabase.table(table_name).insert(stripped_payload).execute()


def update_with_optional_columns(
    supabase: Any,
    table_name: str,
    payload: dict,
    match_column: str,
    match_value: Any,
    optional_columns: set[str],
):
    try:
        return (
            supabase.table(table_name)
            .update(payload)
            .eq(match_column, match_value)
            .execute()
        )
    except Exception as error:
        if not is_missing_column_error(error, list(optional_columns)):
            raise

    stripped_payload = {
        key: value
        for key, value in payload.items()
        if key not in optional_columns
    }
    return (
        supabase.table(table_name)
        .update(stripped_payload)
        .eq(match_column, match_value)
        .execute()
    )


def insert_admin_role_history(
    supabase: Any,
    target_email: str,
    old_role: str | None,
    new_role: str,
    actor: dict,
    reason: str = "",
) -> None:
    payload = {
        "target_email": normalize_admin_email(target_email),
        "old_role": old_role,
        "new_role": new_role,
        "changed_by_user_id": actor.get("id"),
        "changed_by_email": normalize_admin_email(actor.get("email")),
        "reason": reason.strip() or None,
        "created_at": now_utc_iso(),
    }

    try:
        supabase.table("admin_role_history").insert(payload).execute()
    except Exception as error:
        print("[identity admin] role history insert failed:", str(error), flush=True)
        raise HTTPException(status_code=500, detail="Could not record role history right now.")


def insert_identity_audit_log(
    supabase: Any,
    actor: dict,
    action: str,
    target_type: str,
    target_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    payload = {
        "actor_user_id": actor.get("id"),
        "actor_email": normalize_admin_email(actor.get("email")),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "metadata": metadata or {},
        "created_at": now_utc_iso(),
    }

    try:
        supabase.table("identity_audit_logs").insert(payload).execute()
    except Exception as error:
        print("[identity admin] audit insert failed:", str(error), flush=True)
        raise HTTPException(status_code=500, detail="Could not record admin action right now.")


def insert_identity_audit_log_best_effort(
    supabase: Any,
    actor: dict,
    action: str,
    target_type: str,
    target_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    try:
        insert_identity_audit_log(supabase, actor, action, target_type, target_id, metadata)
    except HTTPException as error:
        print("[identity audit] best-effort audit skipped:", error.detail, flush=True)


def ensure_initial_admin_roles(supabase: Any) -> None:
    global INITIAL_ADMIN_ROLES_SEEDED

    if INITIAL_ADMIN_ROLES_SEEDED:
        return

    system_actor = {"id": None, "email": "system"}

    for email, role in INITIAL_ADMIN_ROLES.items():
        normalized_email = normalize_admin_email(email)
        existing = fetch_admin_user_by_email(supabase, normalized_email)

        if existing:
            continue

        now_iso = now_utc_iso()
        try:
            insert_with_optional_columns(supabase, "admin_users", {
                "email": normalized_email,
                "role": role,
                "active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }, {"active", "created_at", "updated_at"})
            insert_admin_role_history(supabase, normalized_email, None, role, system_actor, "Initial role seed")
            insert_identity_audit_log_best_effort(
                supabase,
                system_actor,
                "ADMIN_ROLE_INITIAL_SEED",
                "ADMIN_USER",
                normalized_email,
                {"new_role": role},
            )
        except HTTPException:
            raise
        except Exception as error:
            print("[identity admin] initial admin seed failed:", str(error), flush=True)
            raise HTTPException(status_code=500, detail="Could not prepare admin access right now.")

    INITIAL_ADMIN_ROLES_SEEDED = True


def require_identity_admin(request: Request, allowed_roles: set[str] | None = None) -> dict:
    identity = get_authenticated_identity(request)
    supabase = get_supabase_client()
    ensure_initial_admin_roles(supabase)
    admin_user = fetch_admin_user_by_email(supabase, identity["email"])
    fallback_role = INITIAL_ADMIN_ROLES.get(identity["email"])

    if not admin_user and fallback_role:
        admin_user = {"email": identity["email"], "role": fallback_role, "active": True}

    if not admin_user:
        raise HTTPException(status_code=403, detail="Admin access required.")

    is_active = admin_user.get("active", admin_user.get("is_active", True))

    if is_active is False:
        raise HTTPException(status_code=403, detail="Admin access required.")

    role = normalize_admin_role(admin_user.get("role"))

    if role not in IDENTITY_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required.")

    if allowed_roles and role not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have permission for this action.")

    return {
        **identity,
        "role": role,
        "admin_user": admin_user,
    }


def upsert_admin_user_role(
    supabase: Any,
    target_email: str,
    new_role: str,
    actor: dict,
    reason: str,
) -> dict:
    normalized_email = normalize_admin_email(target_email)
    existing = fetch_admin_user_by_email(supabase, normalized_email)
    old_role = normalize_admin_role(existing.get("role")) if existing else None
    now_iso = now_utc_iso()

    if old_role == new_role and existing:
        return existing

    if existing:
        result = update_with_optional_columns(
            supabase,
            "admin_users",
            {
                "role": new_role,
                "active": True,
                "updated_at": now_iso,
            },
            "email",
            normalized_email,
            {"active", "updated_at"},
        )
        row = get_first_row(result) or {"email": normalized_email, "role": new_role, "active": True}
    else:
        result = insert_with_optional_columns(
            supabase,
            "admin_users",
            {
                "email": normalized_email,
                "role": new_role,
                "active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            },
            {"active", "created_at", "updated_at"},
        )
        row = get_first_row(result) or {"email": normalized_email, "role": new_role, "active": True}

    insert_admin_role_history(supabase, normalized_email, old_role, new_role, actor, reason)
    insert_identity_audit_log(
        supabase,
        actor,
        "ADMIN_ROLE_ASSIGNED",
        "ADMIN_USER",
        normalized_email,
        {"old_role": old_role, "new_role": new_role, "reason": reason.strip() or None},
    )
    return row


def get_verification_request_row(supabase: Any, request_id: str) -> dict:
    result = supabase.table("verification_requests").select("*").eq("id", request_id).limit(1).execute()
    row = get_first_row(result)

    if not row:
        raise HTTPException(status_code=404, detail="Verification request not found.")

    return row


def get_verification_claimed_user_id(verification_row: dict, payload: AdminVerificationDecisionRequest) -> str | None:
    return (
        payload.claimed_by_user_id
        or verification_row.get("claimed_by_user_id")
        or verification_row.get("requester_user_id")
        or verification_row.get("user_id")
    )


def update_reserved_identity_verified(
    supabase: Any,
    verification_row: dict,
    claimed_by_user_id: str | None,
) -> tuple[str, dict]:
    request_type = str(verification_row.get("request_type") or "").strip().upper()
    requested_name = str(verification_row.get("requested_name") or "")
    normalized_key = normalize_identity_key(requested_name)

    if request_type not in {"PERSON", "BRAND"} or not normalized_key:
        raise HTTPException(status_code=400, detail="Verification request is missing identity details.")

    table_name = "reserved_people" if request_type == "PERSON" else "reserved_brands"
    existing = find_reserved_row_by_key(supabase, table_name, normalized_key)

    if not existing:
        raise HTTPException(status_code=404, detail="Reserved identity record not found.")

    update_payload = {
        "verified": True,
        "claimed_by_user_id": claimed_by_user_id,
        "updated_at": now_utc_iso(),
    }
    result = (
        supabase.table(table_name)
        .update(update_payload)
        .eq("normalized_key", normalized_key)
        .execute()
    )
    row = get_first_row(result) or existing
    return table_name, row


def get_excel_header_map(row: tuple[Any, ...]) -> dict[str, int]:
    return {
        str(value or "").strip(): index
        for index, value in enumerate(row)
        if str(value or "").strip()
    }


def get_excel_cell(row: tuple[Any, ...], header_map: dict[str, int], header: str) -> str:
    index = header_map.get(header)

    if index is None or index >= len(row):
        return ""

    value = row[index]
    return str(value or "").strip()


def find_excel_header_row(sheet: Any, required_headers: list[str]) -> tuple[int, dict[str, int]]:
    max_scan_row = min(sheet.max_row, 30)

    for row_number in range(1, max_scan_row + 1):
        row = tuple(cell.value for cell in sheet[row_number])
        header_map = get_excel_header_map(row)

        if all(header in header_map for header in required_headers):
            return row_number, header_map

    raise ValueError("The Excel file does not match the expected template.")


def build_reserved_rows_from_sheet(sheet: Any, config: dict) -> list[dict]:
    header_row_number, header_map = find_excel_header_row(sheet, config["required_headers"])
    rows: list[dict] = []
    seen_keys: set[str] = set()

    for row in sheet.iter_rows(min_row=header_row_number + 1, values_only=True):
        display_value = get_excel_cell(row, header_map, config["display_header"])
        category_value = get_excel_cell(row, header_map, config["category_header"])
        raw_key = get_excel_cell(row, header_map, config["normalized_header"])
        normalized_key = normalize_identity_key(raw_key or display_value)

        if not display_value or not normalized_key or normalized_key in seen_keys:
            continue

        seen_keys.add(normalized_key)
        rows.append({
            config["name_column"]: display_value,
            config["category_column"]: category_value or None,
            "normalized_key": normalized_key,
            "active": True,
            "updated_at": now_utc_iso(),
        })

    return rows


def upsert_reserved_rows(supabase: Any, table_name: str, rows: list[dict]) -> int:
    if not rows:
        return 0

    try:
        result = supabase.table(table_name).upsert(rows, on_conflict="normalized_key").execute()
        return len(result.data or rows)
    except Exception as error:
        if not is_missing_column_error(error, ["active", "updated_at"]):
            raise

    stripped_rows = [
        {key: value for key, value in row.items() if key not in {"active", "updated_at"}}
        for row in rows
    ]
    result = supabase.table(table_name).upsert(stripped_rows, on_conflict="normalized_key").execute()
    return len(result.data or stripped_rows)


def get_reserved_import_configs() -> dict[str, dict]:
    return {
        "Master Clean List": {
            "type": "people",
            "table": "reserved_people",
            "required_headers": [
                "Display Name",
                "Source Tab Category",
                "Normalized Value (No Spaces/Lowercase)",
            ],
            "display_header": "Display Name",
            "category_header": "Source Tab Category",
            "normalized_header": "Normalized Value (No Spaces/Lowercase)",
            "name_column": "display_name",
            "category_column": "category",
        },
        "Master Clean Brand List": {
            "type": "brands",
            "table": "reserved_brands",
            "required_headers": [
                "Brand Display Name",
                "Source Industry Tab",
                "Normalized Key Value",
            ],
            "display_header": "Brand Display Name",
            "category_header": "Source Industry Tab",
            "normalized_header": "Normalized Key Value",
            "name_column": "brand_name",
            "category_column": "industry",
        },
        "Master Clean Org List": {
            "type": "organizations",
            "table": "reserved_brands",
            "required_headers": [
                "Organization Display Name",
                "Source Category Tab",
                "Normalized Key Token",
            ],
            "display_header": "Organization Display Name",
            "category_header": "Source Category Tab",
            "normalized_header": "Normalized Key Token",
            "name_column": "brand_name",
            "category_column": "industry",
        },
    }


@app.get("/", response_class=HTMLResponse)
def home():
    landing_path = Path(__file__).resolve().parents[1] / "client" / "landing" / "index.html"

    if landing_path.exists():
        return FileResponse(landing_path)

    return HTMLResponse(content=ABOUT_PAGE_HTML, status_code=200)


@app.get("/about", response_class=HTMLResponse)
def about_page():
    return HTMLResponse(content=ABOUT_PAGE_HTML, status_code=200)


@app.get("/privacy", response_class=HTMLResponse)
def privacy_page():
    return HTMLResponse(content=PRIVACY_POLICY_HTML, status_code=200)


@app.get("/personal-privacy", response_class=HTMLResponse)
def personal_privacy_page():
    return HTMLResponse(content=PERSONAL_PRIVACY_HTML, status_code=200)


@app.get("/terms", response_class=HTMLResponse)
def terms_page():
    return HTMLResponse(content=TERMS_OF_SERVICE_HTML, status_code=200)


@app.get("/copyright", response_class=HTMLResponse)
def copyright_page():
    return HTMLResponse(content=COPYRIGHT_NOTICE_HTML, status_code=200)


@app.get("/community-guidelines", response_class=HTMLResponse)
def community_guidelines_page():
    return HTMLResponse(content=COMMUNITY_GUIDELINES_HTML, status_code=200)


@app.get("/assets/icon/icon.png")
def app_icon():
    icon_path = Path(__file__).resolve().parents[1] / "assets" / "icon" / "icon.png"

    if not icon_path.exists():
        return HTMLResponse(content="", status_code=404)

    return FileResponse(icon_path, media_type="image/png")


@app.get("/claim/{claim_id}", response_class=HTMLResponse)
def public_claim_page(claim_id: str):
    normalized_claim_id = claim_id.strip()

    if not is_uuid(normalized_claim_id):
        return HTMLResponse(content=build_public_claim_404_page(), status_code=404)

    try:
        claim = fetch_public_claim_row(normalized_claim_id)
    except Exception as error:
        print("[public claim] fetch failed:", normalized_claim_id, error, flush=True)
        return HTMLResponse(content=build_public_claim_error_page(), status_code=503)

    if not claim or claim.get("hidden"):
        return HTMLResponse(content=build_public_claim_404_page(), status_code=404)

    return HTMLResponse(content=build_public_claim_page(claim), status_code=200)


@app.get("/health")
def health():
    # PHASE 4 STEP 21B
    return {"ok": True, "service": "Verifact backend", "version": "phase-4-step-21b"}


@app.post("/identity/check-username")
def identity_check_username(payload: IdentityUsernameCheckRequest):
    try:
        return build_reserved_username_check_response(payload.username)
    except Exception as error:
        print("[identity check] failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not check username right now.")


@app.get("/auth/username-availability")
def username_availability(username: str, request: Request):
    normalized_username = normalize_profile_username_value(username)

    if not is_valid_profile_username(normalized_username):
        return {
            "ok": True,
            "available": False,
            "normalized_username": normalized_username,
            "message": "Username must be 3-20 characters.",
        }

    excluded_user_id = ""
    authorization = request.headers.get("authorization", "")

    if authorization.lower().startswith("bearer "):
        try:
            excluded_user_id = get_authenticated_user_id(request)
        except HTTPException:
            excluded_user_id = ""

    try:
        return check_username_availability_for_save(normalized_username, excluded_user_id)
    except Exception as error:
        print("[username availability] failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not check username availability right now.")


@app.post("/profile/ensure")
def ensure_backend_profile(payload: ProfileEnsureRequest, request: Request):
    identity = get_authenticated_identity(request)
    auth_user = identity["user"]
    user_id = identity["id"]
    supabase = get_supabase_client()

    try:
        existing_profile = fetch_profile_row(supabase, user_id)

        if existing_profile:
            if existing_profile.get("is_deleted"):
                raise HTTPException(status_code=403, detail="This account has been deleted.")

            updates: dict[str, Any] = {}
            email_confirmed = bool(getattr(auth_user, "email_confirmed_at", None))

            if email_confirmed and not existing_profile.get("verified"):
                updates["verified"] = True

            if not existing_profile.get("public_profile_slug"):
                updates["public_profile_slug"] = generate_backend_profile_slug(existing_profile.get("username"), user_id)

            if updates:
                updates["updated_at"] = now_utc_iso()
                update_result = (
                    supabase.table("profiles")
                    .update(updates)
                    .eq("id", user_id)
                    .execute()
                )
                existing_profile = get_first_row(update_result) or {**existing_profile, **updates}

            return build_profile_response(existing_profile)

        preferred_username = normalize_profile_username_value(payload.username) or get_backend_preferred_username(auth_user)

        if not is_valid_profile_username(preferred_username):
            raise HTTPException(status_code=400, detail="Username must be 3-20 characters.")

        availability = check_username_availability_for_save(preferred_username, user_id)

        if not availability.get("available"):
            raise HTTPException(
                status_code=409,
                detail=availability.get("message") or "Username is not available.",
            )

        now_iso = now_utc_iso()
        insert_result = (
            supabase.table("profiles")
            .insert({
                "id": user_id,
                "username": preferred_username,
                "display_name": preferred_username,
                "public_profile_slug": generate_backend_profile_slug(preferred_username, user_id),
                "profile_visibility": "public",
                "verified": bool(getattr(auth_user, "email_confirmed_at", None)),
                "created_at": now_iso,
                "updated_at": now_iso,
            })
            .execute()
        )
        inserted_profile = get_first_row(insert_result) or fetch_profile_row(supabase, user_id)
        return build_profile_response(inserted_profile)
    except HTTPException:
        raise
    except Exception as error:
        print("[profile ensure] failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not save your profile right now.")


@app.patch("/profile")
def update_backend_profile(payload: ProfileUpdateRequest, request: Request):
    identity = get_authenticated_identity(request)
    user_id = identity["id"]
    supabase = get_supabase_client()
    raw_updates = payload.dict(exclude_unset=True)
    updates: dict[str, Any] = {}

    if "username" in raw_updates:
        normalized_username = normalize_profile_username_value(payload.username)

        if not is_valid_profile_username(normalized_username):
            raise HTTPException(status_code=400, detail="Username must be 3-20 characters.")

        try:
            availability = check_username_availability_for_save(normalized_username, user_id)
        except Exception as error:
            print("[profile update] username check failed:", str(error), flush=True)
            raise HTTPException(status_code=503, detail="Could not check username right now.")

        if not availability.get("available"):
            raise HTTPException(
                status_code=409,
                detail=availability.get("message") or "Username is not available.",
            )

        updates["username"] = normalized_username
        updates["display_name"] = normalized_username
        updates["public_profile_slug"] = generate_backend_profile_slug(normalized_username, user_id)

    if "display_name" in raw_updates and "username" not in raw_updates:
        display_name = str(payload.display_name or "").strip()[:80]
        updates["display_name"] = display_name or None

    if "avatar_url" in raw_updates:
        avatar_url = str(payload.avatar_url or "").strip() or None

        if not is_valid_backend_avatar_url(avatar_url):
            raise HTTPException(status_code=400, detail="Avatar URL must be a valid URL.")

        updates["avatar_url"] = avatar_url

    if "avatar_path" in raw_updates:
        updates["avatar_path"] = str(payload.avatar_path or "").strip() or None

    if "bio" in raw_updates:
        updates["bio"] = sanitize_backend_bio(payload.bio)

    if "profile_visibility" in raw_updates:
        updates["profile_visibility"] = normalize_backend_profile_visibility(payload.profile_visibility)

    if not updates:
        return build_profile_response(fetch_profile_row(supabase, user_id))

    updates["updated_at"] = now_utc_iso()

    try:
        result = (
            supabase.table("profiles")
            .update(updates)
            .eq("id", user_id)
            .execute()
        )
        row = get_first_row(result) or fetch_profile_row(supabase, user_id)

        if not row:
            raise HTTPException(status_code=404, detail="Profile not found.")

        return build_profile_response(row)
    except HTTPException:
        raise
    except Exception as error:
        print("[profile update] failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not update your profile right now.")


@app.post("/verification/request")
def create_verification_request(payload: VerificationRequestPayload, request: Request):
    request_type = payload.request_type.strip().upper()
    requested_name = payload.requested_name.strip()

    if request_type not in {"PERSON", "BRAND"}:
        raise HTTPException(status_code=400, detail="Verification type must be PERSON or BRAND.")

    if not requested_name:
        raise HTTPException(status_code=400, detail="Requested name is required.")

    requester = {"id": None, "email": None}
    authorization = request.headers.get("authorization", "")

    if authorization.lower().startswith("bearer "):
        requester = get_authenticated_identity(request)

    now_iso = now_utc_iso()
    row_payload = {
        "request_type": request_type,
        "requested_name": requested_name,
        "normalized_key": normalize_identity_key(requested_name),
        "official_email": payload.official_email.strip() or None,
        "official_website": payload.official_website.strip() or None,
        "social_links": payload.social_links or [],
        "supporting_documents": payload.supporting_documents or [],
        "status": "Pending",
        "requester_user_id": requester.get("id"),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    supabase = get_supabase_client()

    try:
        result = supabase.table("verification_requests").insert(row_payload).execute()
        row = get_first_row(result)
        insert_identity_audit_log_best_effort(
            supabase,
            requester,
            "VERIFICATION_REQUEST_CREATED",
            "VERIFICATION_REQUEST",
            str(row.get("id")) if row else None,
            {"request_type": request_type, "requested_name": requested_name},
        )
        return {"ok": True, "request": row}
    except Exception as error:
        print("[verification request] failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not submit verification request right now.")


@app.post("/admin/reserved/import")
async def admin_reserved_import(request: Request, file: UploadFile = File(...)):
    actor = require_identity_admin(request, {"SUPER_ADMIN", "ADMIN"})

    try:
        from openpyxl import load_workbook
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel import is not configured right now.")

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Excel file is required.")

    try:
        workbook = load_workbook(BytesIO(contents), read_only=True, data_only=True)
    except Exception as error:
        print("[reserved import] workbook load failed:", str(error), flush=True)
        raise HTTPException(status_code=400, detail="Could not read the Excel file.")

    configs = get_reserved_import_configs()
    supabase = get_supabase_client()
    imported: dict[str, int] = {}

    try:
        for sheet_name, config in configs.items():
            if sheet_name not in workbook.sheetnames:
                continue

            rows = build_reserved_rows_from_sheet(workbook[sheet_name], config)
            imported[config["type"]] = upsert_reserved_rows(supabase, config["table"], rows)

        if not imported:
            raise HTTPException(status_code=400, detail="No supported reserved identity sheet was found.")

        insert_identity_audit_log(
            supabase,
            actor,
            "RESERVED_IDENTITIES_IMPORTED",
            "RESERVED_IMPORT",
            file.filename,
            {"filename": file.filename, "imported": imported},
        )
        return {"ok": True, "filename": file.filename, "imported": imported}
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        print("[reserved import] failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not import reserved identities right now.")


@app.get("/admin/verification-requests")
def admin_list_verification_requests(request: Request, status: str = "Pending", limit: int = 100):
    require_identity_admin(request)
    safe_limit = max(1, min(200, int(limit or 100)))
    request_status = status.strip() if status else "Pending"
    supabase = get_supabase_client()

    try:
        query = (
            supabase.table("verification_requests")
            .select("*")
            .order("created_at", desc=True)
            .limit(safe_limit)
        )

        if request_status.upper() != "ALL":
            query = query.eq("status", request_status)

        result = query.execute()
        return {"ok": True, "requests": result.data or []}
    except Exception as error:
        print("[admin verification] list failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not load verification requests right now.")


@app.post("/admin/verification-requests/{request_id}/approve")
def admin_approve_verification_request(
    request_id: str,
    payload: AdminVerificationDecisionRequest,
    request: Request,
):
    actor = require_identity_admin(request, {"SUPER_ADMIN", "ADMIN"})
    supabase = get_supabase_client()
    now_iso = now_utc_iso()

    try:
        verification_row = get_verification_request_row(supabase, request_id)
        claimed_by_user_id = get_verification_claimed_user_id(verification_row, payload)
        reserved_table, reserved_row = update_reserved_identity_verified(
            supabase,
            verification_row,
            claimed_by_user_id,
        )
        update_payload = {
            "status": "Approved",
            "reviewed_by_email": actor["email"],
            "reviewed_at": now_iso,
            "decision_note": payload.decision_note.strip() or None,
            "claimed_by_user_id": claimed_by_user_id,
            "updated_at": now_iso,
        }
        result = (
            supabase.table("verification_requests")
            .update(update_payload)
            .eq("id", request_id)
            .execute()
        )
        updated_request = get_first_row(result)
        insert_identity_audit_log(
            supabase,
            actor,
            "VERIFICATION_REQUEST_APPROVED",
            "VERIFICATION_REQUEST",
            request_id,
            {
                "reserved_table": reserved_table,
                "reserved_identity_id": reserved_row.get("id"),
                "claimed_by_user_id": claimed_by_user_id,
            },
        )
        return {"ok": True, "request": updated_request, "reserved_identity": reserved_row}
    except HTTPException:
        raise
    except Exception as error:
        print("[admin verification] approve failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not approve verification request right now.")


@app.post("/admin/verification-requests/{request_id}/reject")
def admin_reject_verification_request(
    request_id: str,
    payload: AdminVerificationDecisionRequest,
    request: Request,
):
    actor = require_identity_admin(request)
    supabase = get_supabase_client()
    now_iso = now_utc_iso()

    try:
        get_verification_request_row(supabase, request_id)
        result = (
            supabase.table("verification_requests")
            .update({
                "status": "Rejected",
                "reviewed_by_email": actor["email"],
                "reviewed_at": now_iso,
                "decision_note": payload.decision_note.strip() or None,
                "updated_at": now_iso,
            })
            .eq("id", request_id)
            .execute()
        )
        updated_request = get_first_row(result)
        insert_identity_audit_log(
            supabase,
            actor,
            "VERIFICATION_REQUEST_REJECTED",
            "VERIFICATION_REQUEST",
            request_id,
            {"decision_note": payload.decision_note.strip() or None},
        )
        return {"ok": True, "request": updated_request}
    except HTTPException:
        raise
    except Exception as error:
        print("[admin verification] reject failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not reject verification request right now.")


@app.get("/admin/users")
def admin_list_identity_users(request: Request):
    require_identity_admin(request)
    supabase = get_supabase_client()

    try:
        result = supabase.table("admin_users").select("*").order("email").execute()
        return {"ok": True, "users": result.data or []}
    except Exception as error:
        print("[identity admin] list users failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not load admin users right now.")


@app.post("/admin/users/assign-role")
def admin_assign_identity_role(payload: AdminAssignRoleRequest, request: Request):
    actor = require_identity_admin(request)
    target_email = normalize_admin_email(payload.email)
    new_role = normalize_admin_role(payload.role)

    if not target_email or "@" not in target_email:
        raise HTTPException(status_code=400, detail="A valid email is required.")

    allowed_roles = ROLE_ASSIGNMENT_PERMISSIONS.get(actor["role"], set())

    if new_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have permission to assign that role.")

    supabase = get_supabase_client()

    try:
        row = upsert_admin_user_role(supabase, target_email, new_role, actor, payload.reason)
        return {"ok": True, "user": row}
    except HTTPException:
        raise
    except Exception as error:
        print("[identity admin] assign role failed:", str(error), flush=True)
        raise HTTPException(status_code=503, detail="Could not assign admin role right now.")


@app.get("/auth/callback", response_class=HTMLResponse)
def auth_callback_page():
    return HTMLResponse(content=AUTH_CALLBACK_HTML, status_code=200)


@app.get("/auth/confirmed", response_class=HTMLResponse)
def auth_confirmed_page():
    return HTMLResponse(content=AUTH_CALLBACK_HTML, status_code=200)


@app.get("/reset-password", response_class=HTMLResponse)
def reset_password_page():
    return HTMLResponse(content=RESET_PASSWORD_HTML, status_code=200)


@app.get("/auth/reset-password", response_class=HTMLResponse)
def auth_reset_password_page():
    return HTMLResponse(content=RESET_PASSWORD_HTML, status_code=200)


# PHASE 5 STEP 1B
@app.get("/leaderboard")
def leaderboard(request: Request, type: str = "monthly", limit: int = 20):
    enforce_rate_limit(request, "leaderboard", 120, AI_RATE_LIMIT_WINDOW_SECONDS)
    leaderboard_type = "monthly" if type != "alltime" else "alltime"
    # PHASE 5 STEP 1C
    safe_limit = max(1, min(50, int(limit or 50)))
    supabase = get_supabase_client()
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    if leaderboard_type == "monthly":
        reset_result = (
            supabase.table("profiles")
            .update({
                "monthly_reputation_points": 0,
                "monthly_reset_at": datetime.now(timezone.utc).isoformat(),
            })
            .lt("monthly_reset_at", month_start)
            .execute()
        )
        print("[leaderboard] monthly reset rows:", len(reset_result.data or []), flush=True)
        order_column = "monthly_reputation_points"
    else:
        order_column = "reputation_points"

    result = (
        supabase.table("profiles")
        .select("id, username, trust_score, trust_tier, rank_title, highest_rank_achieved, reputation_points, monthly_reputation_points, badge_list")
        .order(order_column, desc=True)
        .order("trust_score", desc=True)
        .limit(safe_limit)
        .execute()
    )

    rows = result.data or []
    users = []
    for index, row in enumerate(rows):
        trust_score = row.get("trust_score") or 50
        current_rank = calculate_rank_title(trust_score)
        display_rank = resolve_display_rank(current_rank, row.get("highest_rank_achieved") or row.get("rank_title"))
        badges = row.get("badge_list") or []
        badge_count = len(badges) if isinstance(badges, list) else 0
        users.append({
            "rank_position": index + 1,
            "id": row.get("id"),
            "username": row.get("username"),
            "rank_title": display_rank,
            "current_rank_title": current_rank,
            "highest_rank_achieved": row.get("highest_rank_achieved") or display_rank,
            "reputation_points": row.get("reputation_points") or 0,
            "monthly_reputation_points": row.get("monthly_reputation_points") or 0,
            "badge_list": badges if isinstance(badges, list) else [],
            "badge_count": badge_count,
            "trust_score": trust_score,
        })

    next_reset = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_reset_month = 1 if next_reset.month == 12 else next_reset.month + 1
    next_reset_year = next_reset.year + 1 if next_reset.month == 12 else next_reset.year
    next_reset = next_reset.replace(year=next_reset_year, month=next_reset_month)

    return {
        "ok": True,
        "type": leaderboard_type,
        "limit": safe_limit,
        "next_monthly_reset_at": next_reset.isoformat(),
        "users": users,
    }


# PHASE 5 STEP 1D
@app.get("/profile/reputation-events")
def profile_reputation_events(request: Request, limit: int = 50):
    authenticated_user_id = get_authenticated_user_id(request)
    safe_limit = max(1, min(50, int(limit or 50)))
    supabase = get_supabase_client()

    result = (
        supabase.table("reputation_events")
        .select("event_type, points_delta, trust_delta, badge_unlocked, rank_before, rank_after, reason, created_at, claim_id")
        .eq("user_id", authenticated_user_id)
        .order("created_at", desc=True)
        .limit(safe_limit)
        .execute()
    )

    return {
        "ok": True,
        "limit": safe_limit,
        "events": result.data or [],
    }


# PHASE 5 STEP 2
# PHASE 5 STEP 4
@app.delete("/account")
def delete_account(request: Request):
    authenticated_user_id = get_authenticated_user_id(request)
    supabase = get_supabase_client()
    deleted_username = f"deleted_{authenticated_user_id.replace('-', '')[-8:]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            supabase.table("profiles")
            .update({
                "is_deleted": True,
                "deleted_at": now_iso,
                "username": deleted_username,
                "display_name": "Deleted User",
                "avatar_url": None,
                "bio": None,
                "public_profile_slug": None,
                "profile_visibility": "private",
                "updated_at": now_iso,
            })
            .eq("id", authenticated_user_id)
            .execute()
        )
    except Exception as error:
        print("[account delete] profile anonymize failed:", str(error), flush=True)
        raise HTTPException(status_code=500, detail="Could not delete account right now.")

    if not result.data:
        raise HTTPException(status_code=404, detail="Account profile not found.")

    return {"ok": True, "mode": "anonymized"}


# PHASE 5 STEP 2
@app.get("/admin/reports")
def admin_list_reports(request: Request, status: str = "OPEN", limit: int = 50):
    require_admin_user(request)
    safe_limit = max(1, min(100, int(limit or 50)))
    report_status = status.strip().upper() if status else "OPEN"
    supabase = get_supabase_client()

    query = (
        supabase.table("reports")
        .select("id,target_type,claim_id,evidence_id,profile_id,user_id,reason,note,status,created_at,updated_at,resolved_at,admin_note")
        .order("created_at", desc=True)
        .limit(safe_limit)
    )

    if report_status != "ALL":
        query = query.eq("status", report_status)

    result = query.execute()
    reports = result.data or []
    supabase = get_supabase_client()

    for report in reports:
        target_type = report.get("target_type") or "CLAIM"
        target = None
        if target_type == "CLAIM" and report.get("claim_id"):
            target_result = supabase.table("claims").select("id,title,author_id,hidden,hidden_reason,is_featured,created_at").eq("id", report["claim_id"]).execute()
            target = (target_result.data or [None])[0]
        elif target_type == "EVIDENCE" and report.get("evidence_id"):
            target_result = supabase.table("evidence").select("id,note,url,user_id,hidden,hidden_reason,created_at").eq("id", report["evidence_id"]).execute()
            target = (target_result.data or [None])[0]
        elif target_type == "PROFILE" and report.get("profile_id"):
            target_result = supabase.table("profiles").select("id,username,display_name,profile_visibility,is_suspended,created_at").eq("id", report["profile_id"]).execute()
            target = (target_result.data or [None])[0]

        report["target"] = target

    return {"ok": True, "reports": reports}


# PHASE 5 STEP 2
@app.post("/admin/reports/{report_id}/resolve")
def admin_resolve_report(report_id: str, payload: AdminReportActionRequest, request: Request):
    admin_user_id = require_admin_user(request)
    supabase = get_supabase_client()
    next_status = payload.status.strip().upper() if payload.status else "RESOLVED"

    if next_status not in {"OPEN", "REVIEWING", "RESOLVED", "DISMISSED"}:
        raise HTTPException(status_code=400, detail="Unsupported report status.")

    report_result = supabase.table("reports").select("*").eq("id", report_id).execute()
    report_row = (report_result.data or [None])[0]

    if not report_row:
        raise HTTPException(status_code=404, detail="Report not found.")

    if payload.hide_target:
        target_type = report_row.get("target_type") or "CLAIM"
        if target_type == "CLAIM" and report_row.get("claim_id"):
            supabase.table("claims").update({
                "hidden": True,
                "hidden_reason": payload.admin_note.strip() or "Removed for violating community guidelines.",
                "hidden_at": datetime.now(timezone.utc).isoformat(),
                "hidden_by": admin_user_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_row["claim_id"]).execute()
        elif target_type == "EVIDENCE" and report_row.get("evidence_id"):
            supabase.table("evidence").update({
                "hidden": True,
                "hidden_reason": payload.admin_note.strip() or "Removed for violating community guidelines.",
                "hidden_at": datetime.now(timezone.utc).isoformat(),
                "hidden_by": admin_user_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_row["evidence_id"]).execute()
        elif target_type == "PROFILE" and report_row.get("profile_id"):
            supabase.table("profiles").update({
                "profile_visibility": "private",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_row["profile_id"]).execute()

    update_result = (
        supabase.table("reports")
        .update({
            "status": next_status,
            "resolved_at": datetime.now(timezone.utc).isoformat() if next_status in {"RESOLVED", "DISMISSED"} else None,
            "resolved_by": admin_user_id if next_status in {"RESOLVED", "DISMISSED"} else None,
            "admin_note": payload.admin_note.strip() or None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", report_id)
        .execute()
    )

    return {"ok": True, "report": (update_result.data or [None])[0]}


# PHASE 5 STEP 3
@app.post("/admin/content/hide")
def admin_hide_content(payload: AdminContentVisibilityRequest, request: Request):
    admin_user_id = require_admin_user(request)
    target_type = payload.target_type.strip().upper()
    target_id = payload.target_id.strip()
    reason = payload.reason.strip() or "Removed for violating community guidelines."
    supabase = get_supabase_client()

    if target_type not in {"CLAIM", "EVIDENCE"} or not target_id:
        raise HTTPException(status_code=400, detail="Unsupported content target.")

    table_name = "claims" if target_type == "CLAIM" else "evidence"
    result = (
        supabase.table(table_name)
        .update({
            "hidden": True,
            "hidden_reason": reason,
            "hidden_at": datetime.now(timezone.utc).isoformat(),
            "hidden_by": admin_user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", target_id)
        .execute()
    )

    return {"ok": True, "target_type": target_type, "target_id": target_id, "updated": len(result.data or [])}


# PHASE 5 STEP 3
@app.post("/admin/content/restore")
def admin_restore_content(payload: AdminContentVisibilityRequest, request: Request):
    require_admin_user(request)
    target_type = payload.target_type.strip().upper()
    target_id = payload.target_id.strip()
    supabase = get_supabase_client()

    if target_type not in {"CLAIM", "EVIDENCE"} or not target_id:
        raise HTTPException(status_code=400, detail="Unsupported content target.")

    table_name = "claims" if target_type == "CLAIM" else "evidence"
    result = (
        supabase.table(table_name)
        .update({
            "hidden": False,
            "hidden_reason": None,
            "hidden_at": None,
            "hidden_by": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", target_id)
        .execute()
    )

    return {"ok": True, "target_type": target_type, "target_id": target_id, "updated": len(result.data or [])}


@app.post("/admin/claims/delete")
def admin_delete_claim(payload: AdminClaimActionRequest, request: Request):
    require_admin_user(request)
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    supabase = get_supabase_client()
    result = supabase.table("claims").delete().eq("id", claim_id).execute()

    return {"ok": True, "claim_id": claim_id, "deleted": len(result.data or [])}


@app.post("/admin/claims/lock-voting")
def admin_lock_claim_voting(payload: AdminClaimActionRequest, request: Request):
    require_admin_user(request)
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase = get_supabase_client()
    result = (
        supabase.table("claims")
        .update({
            "status": "LOCKED",
            "phase4_locked": True,
            "vote_accept_until": now_iso,
            "score_lock_at": now_iso,
            "verdict_reason": payload.reason.strip() or "Voting locked by admin.",
            "updated_at": now_iso,
        })
        .eq("id", claim_id)
        .execute()
    )

    return {"ok": True, "claim_id": claim_id, "updated": len(result.data or [])}


@app.post("/admin/claims/feature")
def admin_feature_claim(payload: AdminClaimActionRequest, request: Request):
    admin_user_id = require_admin_user(request)
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    now_iso = datetime.now(timezone.utc).isoformat()
    featured = bool(payload.featured)
    supabase = get_supabase_client()
    result = (
        supabase.table("claims")
        .update({
            "is_featured": featured,
            "featured_at": now_iso if featured else None,
            "featured_by": admin_user_id if featured else None,
            "updated_at": now_iso,
        })
        .eq("id", claim_id)
        .execute()
    )

    return {"ok": True, "claim_id": claim_id, "featured": featured, "updated": len(result.data or [])}


@app.post("/admin/users/suspend")
def admin_suspend_user(payload: AdminUserActionRequest, request: Request):
    admin_user_id = require_admin_user(request)
    target_user_id = payload.user_id.strip()

    if not target_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    suspended = bool(payload.suspended)

    if suspended and target_user_id == admin_user_id:
        raise HTTPException(status_code=400, detail="Admins cannot suspend their own account.")

    now_iso = datetime.now(timezone.utc).isoformat()
    supabase = get_supabase_client()
    result = (
        supabase.table("profiles")
        .update({
            "is_suspended": suspended,
            "suspended_at": now_iso if suspended else None,
            "suspended_by": admin_user_id if suspended else None,
            "suspension_reason": payload.reason.strip() if suspended and payload.reason.strip() else None,
            "updated_at": now_iso,
        })
        .eq("id", target_user_id)
        .execute()
    )

    return {"ok": True, "user_id": target_user_id, "suspended": suspended, "updated": len(result.data or [])}


# PHASE 5 STEP 1C
@app.post("/admin/reputation/reset-monthly")
def admin_reset_monthly_reputation(request: Request):
    require_admin_user(request)
    supabase = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    result = (
        supabase.table("profiles")
        .update({
            "monthly_reputation_points": 0,
            "monthly_reset_at": now_iso,
        })
        .execute()
    )

    print("[admin monthly reset] rows:", len(result.data or []), flush=True)

    return {
        "ok": True,
        "reset_at": now_iso,
        "rows": len(result.data or []),
    }


# PHASE 5 STEP 1B
@app.post("/admin/claims/override")
def admin_override_claim(payload: AdminOverrideRequest, request: Request):
    require_admin_user(request)
    claim_id = payload.claim_id.strip()
    new_status = payload.new_status.strip().upper()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    if new_status not in {"FINALIZED_TRUE", "FINALIZED_FAKE", "INSUFFICIENT_DATA", "NEEDS_MORE_EVIDENCE"}:
        raise HTTPException(status_code=400, detail="Unsupported override status.")

    supabase = get_supabase_client()
    print("[admin override] claim_id:", claim_id, flush=True)
    print("[admin override] new_status:", new_status, flush=True)

    reverse_result = supabase.rpc("reverse_claim_reputation", {"target_claim_id": claim_id}).execute()
    print("[admin override] reverse rows:", reverse_result.data, flush=True)

    update_result = (
        supabase.table("claims")
        .update({
            "status": new_status,
            "verdict_reason": payload.reason.strip() or "Admin override applied.",
            "verdict_calculated_at": datetime.now(timezone.utc).isoformat(),
            "published_at": datetime.now(timezone.utc).isoformat(),
            "phase4_locked": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", claim_id)
        .execute()
    )

    print("[admin override] updated rows:", len(update_result.data or []), flush=True)

    process_result = supabase.rpc("process_claim_reputation", {"target_claim_id": claim_id}).execute()
    print("[admin override] process result:", process_result.data, flush=True)

    return {
        "ok": True,
        "claim_id": claim_id,
        "status": new_status,
    }


# PHASE 4 STEP 8
@app.get("/ai/library")
def ai_library():
    library = load_verifact_ai_library()
    sections = [
        "verifact_rules",
        "claim_type_rules",
        "source_quality_rules",
        "red_flag_rules",
        "confidence_rules",
        "source_credibility",
    ]

    return {
        "ok": True,
        "rules_loaded": all(section in library for section in sections),
        "sections": sections,
    }


def analyze_claim(payload: AiPrecheckRequest) -> dict:
    # PHASE 4 STEP 9
    source_metadata = score_source_url(payload.source_url)
    # PHASE 4 STEP 21
    source_page = fetch_source_page(payload.source_url)
    return analyze_claim_with_openai(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
        source_metadata=source_metadata,
        source_page=source_page,
    )


# PHASE 4 STEP 9
def log_source_score(endpoint_label: str, source_metadata: dict) -> None:
    print("[source] domain:", source_metadata.get("domain"), flush=True)
    print("[source] quality:", source_metadata.get("source_quality"), flush=True)
    print("[source] score:", source_metadata.get("source_score"), flush=True)


# PHASE 4 STEP 21
def log_source_page(endpoint_label: str, source_page: dict) -> None:
    print(f"[{endpoint_label}] source_read_status:", source_page.get("status"), flush=True)
    print(f"[{endpoint_label}] source_page_title:", source_page.get("title"), flush=True)
    if source_page.get("error"):
        print(f"[{endpoint_label}] source_page_error:", source_page.get("error"), flush=True)
    print(f"[{endpoint_label}] source_excerpt_chars:", len(str(source_page.get("excerpt") or "")), flush=True)


# PHASE 4 STEP 10
def fetch_evidence_rows(claim_id: str) -> list[dict]:
    print("[ai evidence] claim_id:", claim_id, flush=True)
    supabase = get_supabase_client()
    response = (
        supabase.table("evidence")
        .select("id, url, note, evidence_type, source_quality_label, source_quality_score, created_at")
        .eq("claim_id", claim_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    evidence_rows = response.data or []

    if isinstance(evidence_rows, dict):
        evidence_rows = [evidence_rows]

    print("[ai evidence] evidence_count:", len(evidence_rows), flush=True)
    return evidence_rows


def get_supabase_create_client():
    repo_root = str(Path(__file__).resolve().parents[1])
    removed_paths: list[str] = []

    for candidate_path in ("", repo_root):
        if candidate_path in sys.path:
            sys.path.remove(candidate_path)
            removed_paths.append(candidate_path)

    try:
        from supabase import create_client
    except ImportError as error:
        raise RuntimeError("Supabase Python client is not installed on backend.") from error
    finally:
        for candidate_path in reversed(removed_paths):
            sys.path.insert(0, candidate_path)

    return create_client


def get_supabase_client() -> Any:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on backend.")

    return get_supabase_create_client()(supabase_url, service_role_key)


# PHASE 4 STEP 5B
def get_supabase_project_ref() -> str:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    hostname = urlparse(supabase_url).hostname or ""

    if hostname.endswith(".supabase.co"):
        return hostname.split(".")[0]

    return hostname or "unknown"


# PHASE 4 STEP 27
def get_authenticated_user_id(request: Request) -> str:
    authorization = request.headers.get("authorization", "")

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    access_token = authorization.split(" ", 1)[1].strip()

    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        auth_response = get_supabase_client().auth.get_user(access_token)
        auth_user = getattr(auth_response, "user", None)
        user_id = getattr(auth_user, "id", None)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication required.")

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")

    return str(user_id)


# PHASE 5 STEP 1B
def require_admin_user(request: Request) -> str:
    authenticated_user_id = get_authenticated_user_id(request)
    supabase = get_supabase_client()
    result = (
        supabase.table("profiles")
        .select("id,is_admin,is_suspended,is_deleted")
        .eq("id", authenticated_user_id)
        .limit(1)
        .execute()
    )
    profile = (result.data or [None])[0]

    if not profile or not profile.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")

    if profile.get("is_suspended") or profile.get("is_deleted"):
        raise HTTPException(status_code=403, detail="Admin account is not active.")

    return authenticated_user_id


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
def normalize_red_flags(red_flags: object) -> list[str]:
    if red_flags is None:
        return []

    if isinstance(red_flags, str):
        return [red_flags]

    if isinstance(red_flags, list):
        return [str(flag) for flag in red_flags]

    return [str(red_flags)]


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
# PHASE 4 STEP 16
# PHASE 4 STEP 17
# PHASE 4 STEP 20
# PHASE 4 STEP 20B
def build_claim_ai_update_payload(analysis: dict) -> dict:
    claim_type = str(analysis.get("claim_type") or "UNCLEAR").upper()
    if claim_type not in {"FACTUAL", "OPINION", "SATIRE", "QUESTION", "PROMOTION", "UNCLEAR"}:
        claim_type = "UNCLEAR"

    source_quality = normalize_source_quality(analysis.get("source_quality"))
    ai_status = analysis["ai_status"]
    ai_confidence = analysis["ai_confidence"]
    source_count = analysis["source_count"]

    if claim_type in {"OPINION", "QUESTION", "SATIRE", "PROMOTION"}:
        ai_status = "NOT_FACT_CHECKABLE"
        ai_confidence = 0.5
        source_quality = normalize_source_quality(source_quality)
        source_count = 0

    return {
        # PHASE 4 STEP 7
        "claim_type": claim_type,
        "ai_status": ai_status,
        "ai_confidence": ai_confidence,
        "source_quality": source_quality,
        # PHASE 4 STEP 9
        "source_domain": analysis.get("source_domain"),
        "source_score": analysis.get("source_score"),
        "source_reason": analysis.get("source_reason"),
        # PHASE 4 STEP 21
        "source_read_status": analysis.get("source_read_status") or "not_read",
        "source_page_title": analysis.get("source_page_title") or None,
        "source_excerpt": analysis.get("source_excerpt") or None,
        "source_supports_claim": analysis.get("source_supports_claim"),
        "source_support_summary": analysis.get("source_support_summary") or None,
        # PHASE 4 STEP 10
        "evidence_used_count": analysis.get("evidence_used_count", 0),
        "source_count": source_count,
        "red_flags": normalize_red_flags(analysis.get("red_flags")),
        "ai_summary": analysis["ai_summary"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# PHASE 4 STEP 5B
def format_supabase_error(error: Exception) -> dict:
    error_dict = getattr(error, "dict", None)

    if callable(error_dict):
        try:
            data = error_dict()
            return {
                "error": str(data.get("message") or error),
                "details": None if data.get("details") is None else str(data.get("details")),
                "hint": None if data.get("hint") is None else str(data.get("hint")),
            }
        except Exception:
            pass

    return {
        "error": str(getattr(error, "message", None) or error),
        "details": None if getattr(error, "details", None) is None else str(getattr(error, "details")),
        "hint": None if getattr(error, "hint", None) is None else str(getattr(error, "hint")),
    }


# PHASE 4 STEP 5C
def format_supabase_response_error(error: object) -> dict:
    if isinstance(error, dict):
        return {
            "error": str(error.get("message") or error),
            "details": None if error.get("details") is None else str(error.get("details")),
            "hint": None if error.get("hint") is None else str(error.get("hint")),
        }

    return {
        "error": str(getattr(error, "message", None) or error),
        "details": None if getattr(error, "details", None) is None else str(getattr(error, "details")),
        "hint": None if getattr(error, "hint", None) is None else str(getattr(error, "hint")),
    }


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
# PHASE 4 STEP 16
# PHASE 4 STEP 20
# PHASE 4 STEP 20B
# PHASE 4 STEP 20C
def update_claim_ai_fields(claim_id: str, ai_result: dict, endpoint_label: str) -> dict:
    update_payload = build_claim_ai_update_payload(ai_result)
    # PHASE 4 STEP 17
    # PHASE 4 STEP 20
    # PHASE 4 STEP 20B
    # PHASE 4 STEP 20C
    update_payload["source_quality"] = normalize_source_quality(update_payload.get("source_quality"))
    if update_payload["source_quality"] not in ALLOWED_SOURCE_QUALITIES:
        print("[ai] invalid source_quality blocked:", update_payload["source_quality"], flush=True)
        update_payload["source_quality"] = "unknown"

    print(f"[{endpoint_label}] Supabase project_ref:", get_supabase_project_ref(), flush=True)
    print(f"[{endpoint_label}] claim_id:", claim_id, flush=True)
    print("[AI UPDATE FINAL SOURCE QUALITY]", update_payload["source_quality"], flush=True)
    print("[ai] normalized source_quality:", update_payload["source_quality"], flush=True)
    print("[ai] claim_type:", update_payload.get("claim_type"), flush=True)
    # PHASE 4 STEP 27
    print(
        f"[{endpoint_label}] AI result summary:",
        {
            "ai_status": ai_result.get("ai_status"),
            "ai_confidence": ai_result.get("ai_confidence"),
            "source_read_status": ai_result.get("source_read_status"),
            "source_supports_claim": ai_result.get("source_supports_claim"),
        },
        flush=True,
    )

    try:
        supabase = get_supabase_client()
        update_result = (
            supabase.table("claims")
            .update(update_payload)
            .eq("id", claim_id)
            .execute()
        )
        print(f"[{endpoint_label}] update_result rows:", len(update_result.data or []), flush=True)

        update_error = getattr(update_result, "error", None)
        if update_error:
            formatted_error = format_supabase_response_error(update_error)
            print(f"[{endpoint_label}] update_error:", formatted_error, flush=True)
            return {
                "ok": False,
                "update_payload": update_payload,
                **formatted_error,
            }

        fetch_result = (
            supabase.table("claims")
            .select("id, claim_type, ai_status, ai_confidence, source_quality, source_domain, source_score, source_reason, source_read_status, source_page_title, source_supports_claim, source_support_summary, evidence_used_count, red_flags, ai_summary, source_count, updated_at")
            .eq("id", claim_id)
            .execute()
        )
    except Exception as error:
        formatted_error = format_supabase_error(error)
        print(f"[{endpoint_label}] update_error:", formatted_error, flush=True)
        return {
            "ok": False,
            "update_payload": update_payload,
            **formatted_error,
        }

    fetch_error = getattr(fetch_result, "error", None)
    if fetch_error:
        formatted_error = format_supabase_response_error(fetch_error)
        print(f"[{endpoint_label}] fetch_error:", formatted_error, flush=True)
        return {
            "ok": False,
            "update_payload": update_payload,
            **formatted_error,
        }

    updated_claim = fetch_result.data
    if isinstance(updated_claim, list):
        updated_claim = updated_claim[0] if updated_claim else None

    print(
        f"[{endpoint_label}] fetched updated claim summary:",
        {
            "id": updated_claim.get("id") if updated_claim else None,
            "ai_status": updated_claim.get("ai_status") if updated_claim else None,
            "source_read_status": updated_claim.get("source_read_status") if updated_claim else None,
        },
        flush=True,
    )

    if not updated_claim:
        return {
            "ok": False,
            "claim_id": claim_id,
            "error": "Supabase update ran but updated claim could not be fetched",
            "update_payload": update_payload,
        }

    if updated_claim.get("ai_summary") != update_payload["ai_summary"]:
        return {
            "ok": False,
            "claim_id": claim_id,
            "error": "Supabase update did not persist new AI fields",
            "ai_result": ai_result,
            "update_payload": update_payload,
            "updated_claim": updated_claim,
        }

    return {
        "ok": True,
        "ai_result": ai_result,
        "update_payload": update_payload,
        "updated_claim": updated_claim,
    }


# PHASE 4 STEP 3
# PHASE 4 STEP 17
def build_ai_error_analysis() -> dict:
    return {
        # PHASE 4 STEP 7
        "claim_type": "UNCLEAR",
        "ai_confidence": 0.5,
        "source_count": 0,
        "source_quality": "unknown",
        # PHASE 4 STEP 21
        "source_read_status": "not_read",
        "source_page_title": None,
        "source_excerpt": None,
        "source_supports_claim": None,
        "source_support_summary": "Source page was not read because AI pre-check failed.",
        # PHASE 4 STEP 10
        "evidence_used_count": 0,
        "red_flags": ["AI pre-check failed"],
        "ai_summary": "AI pre-check failed. Community voting and evidence are still available.",
        "ai_status": "ERROR",
    }


# PHASE 4 STEP 3
def mark_claim_ai_error(claim_id: str) -> str | None:
    error_analysis = build_ai_error_analysis()
    result = update_claim_ai_fields(claim_id, error_analysis, "ai/precheck/error")

    if not result.get("ok"):
        return str(result.get("error") or "Supabase error status update failed.")

    return None


def build_safe_ai_precheck_failure(claim_id: str) -> dict:
    return {
        "ok": False,
        "claim_id": claim_id,
        "error": "AI pre-check is unavailable right now.",
        "details": None,
        "hint": None,
    }


# PHASE 4 STEP 5B
# PHASE 4 STEP 5C
# PHASE 4 STEP 5D
# PHASE 4 STEP 16
def build_ai_precheck_response(claim_id: str, update_result: dict) -> dict:
    updated_claim = update_result["updated_claim"]
    red_flags = normalize_red_flags(updated_claim.get("red_flags"))
    # PHASE 4 STEP 27
    safe_updated_claim = {
        "id": updated_claim.get("id"),
        "claim_type": updated_claim.get("claim_type"),
        "ai_status": updated_claim.get("ai_status"),
        "ai_confidence": updated_claim.get("ai_confidence"),
        "source_quality": updated_claim.get("source_quality"),
        "source_domain": updated_claim.get("source_domain"),
        "source_score": updated_claim.get("source_score"),
        "source_reason": updated_claim.get("source_reason"),
        "source_read_status": updated_claim.get("source_read_status"),
        "source_page_title": updated_claim.get("source_page_title"),
        "source_supports_claim": updated_claim.get("source_supports_claim"),
        "source_support_summary": updated_claim.get("source_support_summary"),
        "evidence_used_count": updated_claim.get("evidence_used_count"),
        "red_flags": red_flags,
        "ai_summary": updated_claim.get("ai_summary"),
        "source_count": updated_claim.get("source_count"),
        "updated_at": updated_claim.get("updated_at"),
    }

    return {
        "ok": True,
        "claim_id": claim_id,
        # PHASE 4 STEP 7
        "claim_type": updated_claim.get("claim_type"),
        "ai_confidence": updated_claim.get("ai_confidence"),
        "source_count": updated_claim.get("source_count"),
        "source_quality": updated_claim.get("source_quality"),
        # PHASE 4 STEP 9
        "source_domain": updated_claim.get("source_domain"),
        "source_score": updated_claim.get("source_score"),
        "source_reason": updated_claim.get("source_reason"),
        # PHASE 4 STEP 21
        "source_read_status": updated_claim.get("source_read_status"),
        "source_page_title": updated_claim.get("source_page_title"),
        "source_supports_claim": updated_claim.get("source_supports_claim"),
        "source_support_summary": updated_claim.get("source_support_summary"),
        # PHASE 4 STEP 10
        "evidence_used_count": updated_claim.get("evidence_used_count"),
        "red_flags": red_flags,
        "ai_summary": updated_claim.get("ai_summary"),
        "ai_status": updated_claim.get("ai_status"),
        "error": None,
        "details": None,
        "hint": None,
        "supabase_updated": True,
        "updated_claim": safe_updated_claim,
    }


# PHASE 4 STEP 3
def fetch_claim_row(claim_id: str) -> dict | None:
    supabase = get_supabase_client()
    response = supabase.table("claims").select("*").eq("id", claim_id).limit(1).execute()
    rows = response.data or []

    if isinstance(rows, dict):
        return rows

    if not rows:
        return None

    return rows[0]


# PHASE 4 STEP 3
def build_precheck_payload_from_claim(claim: dict) -> AiPrecheckRequest:
    return AiPrecheckRequest(
        claim_id=str(claim.get("id") or ""),
        title=str(claim.get("title") or ""),
        description=str(claim.get("description") or ""),
        source_url=str(claim.get("source_url") or ""),
        category=str(claim.get("category") or ""),
    )


# PHASE 4 STEP 9
@app.get("/ai/source-score")
def ai_source_score(request: Request, url: str = ""):
    # PHASE 4 STEP 27
    enforce_rate_limit(request, "ai_source_score", SOURCE_SCORE_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_SECONDS)
    source_metadata = score_source_url(url)
    log_source_score("ai/source-score", source_metadata)
    return source_metadata


@app.post("/ai/precheck", response_model=AiPrecheckResponse, response_model_exclude_none=True)
def ai_precheck(payload: AiPrecheckRequest, request: Request):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    # PHASE 4 STEP 27
    enforce_rate_limit(request, "ai_precheck", AI_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_SECONDS)
    authenticated_user_id = get_authenticated_user_id(request)
    enforce_claim_ai_cooldown(claim_id)
    claim = fetch_claim_row(claim_id)

    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    payload = build_precheck_payload_from_claim(claim)
    print("[ai/precheck] authenticated user:", authenticated_user_id, flush=True)
    # PHASE 4 STEP 9
    source_metadata = score_source_url(payload.source_url)
    log_source_score("ai/precheck", source_metadata)
    # PHASE 4 STEP 21
    source_page = fetch_source_page(payload.source_url)
    log_source_page("ai/precheck", source_page)
    ai_result = analyze_claim_with_openai(
        title=payload.title,
        description=payload.description,
        source_url=payload.source_url,
        category=payload.category,
        source_metadata=source_metadata,
        source_page=source_page,
    )
    print("[ai/precheck] called", flush=True)
    print(f"[ai/precheck] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck] claim_id={payload.claim_id}", flush=True)
    print(f"[ai/precheck] source_url={payload.source_url}", flush=True)
    # PHASE 4 STEP 7
    print("[ai] claim_type:", ai_result.get("claim_type"), flush=True)
    print(f"[ai/precheck] ai_status={ai_result['ai_status']}", flush=True)
    print(f"[ai/precheck] ai_confidence={ai_result['ai_confidence']}", flush=True)
    print(f"[ai/precheck] source_quality={ai_result['source_quality']}", flush=True)
    print("[ai/precheck] OpenAI analysis completed", flush=True)
    update_result = update_claim_ai_fields(payload.claim_id, ai_result, "ai/precheck")

    if not update_result.get("ok"):
        print(f"[ai/precheck] Supabase update failure: {update_result.get('error')}", flush=True)
        return build_safe_ai_precheck_failure(payload.claim_id)

    print("[ai/precheck] Supabase update success", flush=True)
    return build_ai_precheck_response(payload.claim_id, update_result)


# PHASE 4 STEP 3
@app.post("/ai/precheck/retry", response_model=AiPrecheckResponse, response_model_exclude_none=True)
def retry_ai_precheck(payload: AiPrecheckRetryRequest, request: Request):
    claim_id = payload.claim_id.strip()

    if not claim_id:
        raise HTTPException(status_code=400, detail="claim_id is required")

    # PHASE 4 STEP 27
    enforce_rate_limit(request, "ai_precheck_retry", AI_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_SECONDS)
    authenticated_user_id = get_authenticated_user_id(request)
    enforce_claim_ai_cooldown(claim_id)
    print("[ai/precheck/retry] called", flush=True)
    print(f"[ai/precheck/retry] OPENAI_MODEL={get_openai_model()}", flush=True)
    print(f"[ai/precheck/retry] claim_id={claim_id}", flush=True)
    print("[ai/precheck/retry] authenticated user:", authenticated_user_id, flush=True)

    try:
        claim = fetch_claim_row(claim_id)

        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        previous_status = claim.get("ai_status") or "PENDING"
        print(f"[ai/precheck/retry] previous_ai_status={previous_status}", flush=True)

        retry_payload = build_precheck_payload_from_claim(claim)
        # PHASE 4 STEP 9
        source_metadata = score_source_url(retry_payload.source_url)
        log_source_score("ai/precheck/retry", source_metadata)
        # PHASE 4 STEP 21
        source_page = fetch_source_page(retry_payload.source_url)
        log_source_page("ai/precheck/retry", source_page)
        # PHASE 4 STEP 10
        evidence_rows = fetch_evidence_rows(claim_id)
        ai_result = analyze_claim_with_openai(
            title=retry_payload.title,
            description=retry_payload.description,
            source_url=retry_payload.source_url,
            category=retry_payload.category,
            source_metadata=source_metadata,
            source_page=source_page,
            evidence_rows=evidence_rows,
        )
        # PHASE 4 STEP 7
        print("[ai] claim_type:", ai_result.get("claim_type"), flush=True)
        print(f"[ai/precheck/retry] new_ai_status={ai_result['ai_status']}", flush=True)
        print(f"[ai/precheck/retry] ai_confidence={ai_result['ai_confidence']}", flush=True)
        print(f"[ai/precheck/retry] source_quality={ai_result['source_quality']}", flush=True)
        print("[ai/precheck/retry] OpenAI analysis completed", flush=True)
        update_result = update_claim_ai_fields(claim_id, ai_result, "ai/precheck/retry")

        if not update_result.get("ok"):
            print(f"[ai/precheck/retry] Supabase update failure: {update_result.get('error')}", flush=True)
            return build_safe_ai_precheck_failure(claim_id)

        print("[ai/precheck/retry] Supabase update success", flush=True)
        return build_ai_precheck_response(claim_id, update_result)
    except HTTPException:
        raise
    except Exception as error:
        print(f"[ai/precheck/retry] failure: {error}", flush=True)
        error_update = mark_claim_ai_error(claim_id)

        if error_update:
            print(f"[ai/precheck/retry] Supabase update failure: {error_update}", flush=True)
        else:
            print("[ai/precheck/retry] Supabase ERROR status update success", flush=True)

        error_analysis = build_ai_error_analysis()
        return {
            "ok": False,
            "claim_id": claim_id,
            **error_analysis,
            "error": "AI pre-check failed. Please retry.",
        }
