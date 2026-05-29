param(
    [string]$ProjectRef = "otvlvdjjtuhobeslcvwr",
    [switch]$SkipLogin,
    [switch]$SkipDbPush,
    [switch]$SkipFunctionDeploy
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

function Invoke-Supabase {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @Args
    } else {
        & npx -y supabase@2.67.3 @Args
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Supabase command failed: $($Args -join ' ')"
    }
}

function Read-DotEnvValue {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (!(Test-Path ".env")) {
        return $null
    }

    $line = Get-Content ".env" | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -First 1
    if (!$line) {
        return $null
    }

    return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", "").Trim().Trim('"').Trim("'")
}

if (!$SkipLogin) {
    Write-Host "Opening Supabase login if needed..."
    Invoke-Supabase login
}

Write-Host "Linking Supabase project $ProjectRef..."
Invoke-Supabase link --project-ref $ProjectRef

$deepseekKey = $env:DEEPSEEK_API_KEY
if (!$deepseekKey) {
    $deepseekKey = Read-DotEnvValue "DEEPSEEK_API_KEY"
}

if ($deepseekKey -and $deepseekKey -notmatch "^replace_with_") {
    Write-Host "Setting DEEPSEEK_API_KEY as a Supabase Edge Function secret..."
    Invoke-Supabase secrets set "DEEPSEEK_API_KEY=$deepseekKey"
} else {
    Write-Host "Skipping DEEPSEEK_API_KEY secret. Set `$env:DEEPSEEK_API_KEY or add it to .env, then rerun this script."
}

if (!$SkipDbPush) {
    Write-Host "Applying Supabase migrations..."
    Invoke-Supabase db push
}

if (!$SkipFunctionDeploy) {
    Write-Host "Deploying ask-ai Edge Function..."
    Invoke-Supabase functions deploy ask-ai --no-verify-jwt
}

Write-Host "Supabase deployment flow complete."
