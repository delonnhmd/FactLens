# Supabase auth verification and recovery setup

Use these values in the Supabase Dashboard for FactFight web email verification and password recovery. Keep the listed legacy mobile redirects until the installed Expo app no longer depends on them.

## URL Configuration

Authentication -> URL Configuration

Site URL:

```txt
https://factfight.com
```

Redirect URLs:

```txt
https://factfight.com/auth/callback
https://factfight.com/auth/callback?next=/reset-password
https://www.factfight.com/auth/callback
https://www.factfight.com/auth/callback?next=/reset-password
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/reset-password
```

The `www` entries are required while `factfight.com` immediately redirects to `www.factfight.com` in production.

Preserve the existing mobile, Expo, and legacy web callback URLs:

```txt
https://verifact.pennyfloat.com/auth/callback
https://verifact.pennyfloat.com/reset-password
https://verifact.pennyfloat.com/auth/reset-password
verifact://auth/callback
exp+factlens://auth/callback
exp+verifact://auth/callback
```

FactFight web password recovery must use:

```txt
https://factfight.com/auth/callback?next=/reset-password
```

## Confirm Signup Email Template

Authentication -> Email Templates -> Confirm signup

Subject:

```txt
Verify your FactFight account
```

HTML template:

```html
<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="text-align:center; padding: 18px 0;">
    <h1 style="margin:0; color:#0D1B3E;">FactFight</h1>
    <p style="margin:8px 0 0; color:#475569;">Fight misinformation, not each other.</p>
  </div>

  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:24px;">
    <h2 style="margin-top:0; color:#0f172a;">Verify your email</h2>
    <p style="font-size:16px; line-height:1.5;">
      Welcome to FactFight. Please confirm your email address to activate your account.
    </p>

    <div style="text-align:center; margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="background:#0D1B3E; color:#ffffff; padding:14px 22px; border-radius:10px; text-decoration:none; font-weight:600; display:inline-block;">
        Verify Email
      </a>
    </div>

    <p style="font-size:13px; color:#64748b;">
      If you did not create a FactFight account, you can ignore this email.
    </p>
  </div>

  <p style="font-size:12px; color:#94a3b8; text-align:center; margin-top:20px;">
    Copyright 2026 MD Media LLC. FactFight is a community-powered claim verification platform.
  </p>
</div>
```

## Reset Password Email Template

Authentication -> Email Templates -> Reset password

Subject:

```txt
Reset your FactFight password
```

HTML template:

```html
<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="text-align:center; padding: 18px 0;">
    <h1 style="margin:0; color:#0D1B3E;">FactFight</h1>
    <p style="margin:8px 0 0; color:#475569;">Fight misinformation, not each other.</p>
  </div>

  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:24px;">
    <h2 style="margin-top:0; color:#0f172a;">Reset your password</h2>
    <p style="font-size:16px; line-height:1.5;">
      We received a request to reset your FactFight password. Click the button below to create a new password.
    </p>

    <div style="text-align:center; margin:28px 0;">
      <a href="{{ .ConfirmationURL }}" style="background:#0D1B3E; color:#ffffff; padding:14px 22px; border-radius:10px; text-decoration:none; font-weight:600; display:inline-block;">
        Reset Password
      </a>
    </div>

    <p style="font-size:13px; color:#64748b;">
      If you did not request this password reset, you can safely ignore this email.
    </p>
  </div>

  <p style="font-size:12px; color:#94a3b8; text-align:center; margin-top:20px;">
    Copyright 2026 MD Media LLC. FactFight is a community-powered claim verification platform.
  </p>
</div>
```

## Custom SMTP

Authentication -> SMTP Settings

```txt
Host: smtp.resend.com
Port: 465
Username: resend
Password: RESEND_API_KEY
Sender name: FactFight
Sender email: support@factfight.com
```

The Resend sending domain must be verified in DNS before Supabase sends from this address.

If signup returns `unexpected_failure` with `Error sending confirmation email`, inspect Supabase Authentication logs and verify the SMTP host, port, username, API key, verified sending domain, sender address, and provider quota. Do not disable email confirmation to bypass delivery failures.
