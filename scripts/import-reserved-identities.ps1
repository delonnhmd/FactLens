param(
  [string]$BackendUrl = "https://factlens-e8uf.onrender.com",
  [string]$Token = $env:FACTLENS_ADMIN_ACCESS_TOKEN,
  [string]$ImportRoot = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $ImportRoot) {
  $ImportRoot = Join-Path $PSScriptRoot "..\supabase\imports\reserved-identities"
}

$resolvedImportRoot = Resolve-Path -LiteralPath $ImportRoot

$imports = @(
  @{
    Label = "reserved usernames"
    Type = "people"
    File = Join-Path $resolvedImportRoot "people\reserved_usernames_list.xlsx"
  },
  @{
    Label = "reserved brands"
    Type = "brands"
    File = Join-Path $resolvedImportRoot "brands\reserved_brands_list.xlsx"
  },
  @{
    Label = "reserved organizations"
    Type = "brands"
    File = Join-Path $resolvedImportRoot "organizations\reserved_organizations_list.xlsx"
  }
)

foreach ($item in $imports) {
  if (-not (Test-Path -LiteralPath $item.File)) {
    throw "Missing $($item.Label) workbook: $($item.File)"
  }
}

if (-not $Token -and -not $DryRun) {
  throw "Missing admin access token. Pass -Token or set FACTLENS_ADMIN_ACCESS_TOKEN."
}

$endpoint = "$($BackendUrl.TrimEnd('/'))/admin/import/reserved-identities"

foreach ($item in $imports) {
  Write-Host "Importing $($item.Label) from $($item.File)"

  if ($DryRun) {
    Write-Host "curl.exe -X POST `"$endpoint`" -H `"Authorization: Bearer <token>`" -F `"type=$($item.Type)`" -F `"file=@$($item.File)`""
    continue
  }

  $response = & curl.exe -sS --fail-with-body -X POST $endpoint `
    -H "Authorization: Bearer $Token" `
    -F "type=$($item.Type)" `
    -F "file=@$($item.File)"

  if ($LASTEXITCODE -ne 0) {
    throw "Import failed for $($item.Label)."
  }

  Write-Output $response
}
