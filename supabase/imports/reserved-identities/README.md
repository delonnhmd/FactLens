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
.\scripts\import-reserved-identities.ps1 -Token "PASTE_ADMIN_SUPABASE_ACCESS_TOKEN"
```

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
