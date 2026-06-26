# Reserved Identity Imports

Local staging folder for reserved identity Excel imports.

## Files

- `people/reserved_usernames_list.xlsx`
  - Upload with `type=people`
  - Imports into `reserved_people`
- `brands/reserved_brands_list.xlsx`
  - Upload with `type=brands`
  - Imports into `reserved_brands`
- `organizations/reserved_organizations_list.xlsx`
  - Upload with `type=brands`
  - Imports organization names into `reserved_brands`

## Backend Upload Route

`POST /admin/import/reserved-identities`

This route requires a `SUPER_ADMIN` or `ADMIN` bearer token.

## One-Command Import

From the repo root:

```powershell
.\scripts\import-reserved-identities.ps1 -AdminEmail "md.noithat@gmail.com"
```

The script will prompt for that Supabase user's password and then upload with the returned access token.

If you already have a logged-in admin access token:

```powershell
.\scripts\import-reserved-identities.ps1 -Token "PASTE_REAL_ADMIN_ACCESS_TOKEN"
```

The `-Token` value must be a Supabase Auth `access_token` for a logged-in `SUPER_ADMIN` or `ADMIN` user. It usually starts with `eyJ`.

Do not use:

- Supabase dashboard personal access tokens that start with `sbp_`
- Supabase service role keys
- Supabase anon keys

## Supabase SQL Editor Import

Use this option if you log in to the Supabase Dashboard with GitHub and do not have an app-user password.

Generate the SQL file from the local Excel files:

```powershell
python .\scripts\generate-reserved-identities-sql.py
```

Then open this generated file:

```text
C:\FactLens\supabase\imports\reserved-identities\generated\import_reserved_identities.sql
```

Copy the full file into the Supabase SQL Editor and run it.

The generated SQL has separate sections for people, brands, and organizations. Organization rows are still upserted into `reserved_brands`, because the app's username protection checks `reserved_people` and `reserved_brands`.

To preview the uploads without sending data:

```powershell
.\scripts\import-reserved-identities.ps1 -DryRun
```

## PowerShell Upload Examples

```powershell
$token = "PASTE_ADMIN_SUPABASE_ACCESS_TOKEN"
$backend = "https://factlens-e8uf.onrender.com"

curl.exe -X POST "$backend/admin/import/reserved-identities" `
  -H "Authorization: Bearer $token" `
  -F "type=people" `
  -F "file=@C:\FactLens\supabase\imports\reserved-identities\people\reserved_usernames_list.xlsx"

curl.exe -X POST "$backend/admin/import/reserved-identities" `
  -H "Authorization: Bearer $token" `
  -F "type=brands" `
  -F "file=@C:\FactLens\supabase\imports\reserved-identities\brands\reserved_brands_list.xlsx"

curl.exe -X POST "$backend/admin/import/reserved-identities" `
  -H "Authorization: Bearer $token" `
  -F "type=brands" `
  -F "file=@C:\FactLens\supabase\imports\reserved-identities\organizations\reserved_organizations_list.xlsx"
```

After these imports succeed, usernames from these lists should return reserved from:

```powershell
curl.exe -X POST "https://factlens-e8uf.onrender.com/identity/check-username" `
  -H "Content-Type: application/json" `
  --data-raw '{"username":"Elon_Musk"}'
```
