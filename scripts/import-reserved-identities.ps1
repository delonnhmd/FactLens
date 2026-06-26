param(
  [string]$BackendUrl = "https://factlens-e8uf.onrender.com",
  [string]$Token = $env:FACTLENS_ADMIN_ACCESS_TOKEN,
  [string]$AdminEmail = "",
  [string]$ImportRoot = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-ProjectEnvValue {
  param([string[]]$Names)

  foreach ($name in $Names) {
    $value = [Environment]::GetEnvironmentVariable($name)

    if ($value) {
      return $value
    }
  }

  $envPath = Join-Path $PSScriptRoot "..\.env"

  if (-not (Test-Path -LiteralPath $envPath)) {
    return ""
  }

  foreach ($line in Get-Content -LiteralPath $envPath) {
    foreach ($name in $Names) {
      if ($line -match "^\s*$([regex]::Escape($name))\s*=\s*(.*)\s*$") {
        return $matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }

  return ""
}

function Convert-SecureStringToPlainText {
  param([Security.SecureString]$SecureValue)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Get-AdminAccessTokenFromPassword {
  param([string]$Email)

  $supabaseUrl = Get-ProjectEnvValue @("SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL")
  $anonKey = Get-ProjectEnvValue @("EXPO_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")

  if (-not $supabaseUrl -or -not $anonKey) {
    throw "Missing Supabase URL or anon key in .env. Pass -Token instead."
  }

  $securePassword = Read-Host "Supabase password for $Email" -AsSecureString
  $plainPassword = Convert-SecureStringToPlainText $securePassword

  try {
    $loginBody = @{
      email = $Email
      password = $plainPassword
    } | ConvertTo-Json -Compress

    $response = Invoke-RestMethod `
      -Method Post `
      -Uri "$($supabaseUrl.TrimEnd('/'))/auth/v1/token?grant_type=password" `
      -Headers @{
        apikey = $anonKey
        Authorization = "Bearer $anonKey"
      } `
      -ContentType "application/json" `
      -Body $loginBody
  } catch {
    throw "Could not sign in to Supabase as $Email. Check the email, password, and that this account is confirmed."
  } finally {
    $plainPassword = $null
  }

  if (-not $response.access_token) {
    throw "Supabase sign-in did not return an access token."
  }

  return $response.access_token
}

function Assert-RealAccessToken {
  param([string]$AccessToken)

  $placeholderTokens = @(
    "YOUR_ADMIN_ACCESS_TOKEN",
    "PASTE_ADMIN_SUPABASE_ACCESS_TOKEN",
    "<token>",
    "token"
  )

  if (-not $AccessToken) {
    throw "Missing admin access token. Pass -Token, set FACTLENS_ADMIN_ACCESS_TOKEN, or use -AdminEmail."
  }

  if ($AccessToken.Trim() -in $placeholderTokens) {
    throw "The token value is still a placeholder. Use -AdminEmail `"md.noithat@gmail.com`" to sign in, or paste a real Supabase access token."
  }
}

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

if (-not $Token -and $AdminEmail -and -not $DryRun) {
  $Token = Get-AdminAccessTokenFromPassword $AdminEmail
}

if (-not $DryRun) {
  Assert-RealAccessToken $Token
}

$endpoint = "$($BackendUrl.TrimEnd('/'))/admin/import/reserved-identities"

foreach ($item in $imports) {
  Write-Host "Importing $($item.Label) from $($item.File)"

  if ($DryRun) {
    Write-Host "curl.exe -X POST `"$endpoint`" -H `"Authorization: Bearer <token>`" -F `"type=$($item.Type)`" -F `"file=@$($item.File)`""
    continue
  }

  $tempBody = New-TemporaryFile

  try {
    $statusCode = & curl.exe -sS -w "%{http_code}" -o $tempBody.FullName -X POST $endpoint `
      -H "Authorization: Bearer $Token" `
      -F "type=$($item.Type)" `
      -F "file=@$($item.File)"
    $curlExitCode = $LASTEXITCODE
    $responseBody = Get-Content -Raw -LiteralPath $tempBody.FullName

    if ($curlExitCode -ne 0) {
      throw "Upload failed for $($item.Label). Check your network connection and backend URL."
    }

    if ($statusCode -eq "401") {
      throw "Unauthorized. Use a real logged-in SUPER_ADMIN or ADMIN Supabase access token."
    }

    if ($statusCode -eq "403") {
      throw "Forbidden. The logged-in user must be SUPER_ADMIN or ADMIN in admin_users."
    }

    if ($statusCode -notmatch "^2\d\d$") {
      throw "Import failed for $($item.Label). HTTP $statusCode. $responseBody"
    }

    Write-Output $responseBody
  } finally {
    Remove-Item -LiteralPath $tempBody.FullName -Force -ErrorAction SilentlyContinue
  }
}
