# Supabase Auth Verification Setup

Use these values in the Supabase Dashboard for the Verifact email verification flow.

## URL Configuration

Authentication -> URL Configuration

Site URL:

```txt
https://verifact.pennyfloat.com
```

Redirect URLs:

```txt
https://verifact.pennyfloat.com/auth/callback
verifact://auth/callback
exp+factlens://auth/callback
exp+verifact://auth/callback
```

Keep the old FactLens redirect URLs temporarily if already-installed test builds still need them.

## Confirm Signup Email Template

Authentication -> Email Templates -> Confirm signup

Subject:

```txt
Verify your Verifact account
```

Body:

```html
<div style="margin:0;background:#f5f7fa;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#172033;">
  <div style="margin:0 auto;max-width:520px;border:1px solid #e4e7ec;border-radius:18px;background:#ffffff;padding:28px;">
    <div style="margin-bottom:20px;font-size:14px;font-weight:800;color:#0d1b3e;">Verifact</div>
    <h2 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#0d1b3e;">Verify your email</h2>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#667085;">Welcome to Verifact.</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#667085;">
      Please confirm your email address to activate your account.
    </p>
    <a
      href="{{ .ConfirmationURL }}"
      style="display:inline-block;border-radius:8px;background:#0d1b3e;padding:12px 16px;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none;"
    >
      Verify Email
    </a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#667085;">
      The red. The blue. The truth.
    </p>
  </div>
</div>
```
