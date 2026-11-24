param(
    [string]$ProjectRef = "ejuwvqjaserearyvohxw",
    [switch]$SkipLogin,
    [switch]$SkipDbPush,
    [switch]$SkipFunctionDeploy
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

function Invoke-Supabase {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$SupabaseArgs)

    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @SupabaseArgs
    } else {
        & npx -y supabase@2.106.0 @SupabaseArgs
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Supabase command failed: $($SupabaseArgs -join ' ')"
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

$secretsToSet = @()

foreach ($secretName in @("DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "APP_ORIGIN")) {
    $value = [Environment]::GetEnvironmentVariable($secretName)
    if (!$value) {
        $value = Read-DotEnvValue $secretName
    }
    if ($value -and $value -notmatch "^replace_with_") {
        $secretsToSet += "$secretName=$value"
    }
}

if ($secretsToSet.Count -gt 0) {
    Write-Host "Setting Supabase Edge Function secrets..."
    Invoke-Supabase secrets set @secretsToSet
} else {
    Write-Host "Skipping Edge Function secrets. Set DEEPSEEK_API_KEY / LIVEKIT_API_KEY / LIVEKIT_API_SECRET in env or .env, then rerun."
}

if (!$SkipDbPush) {
    Write-Host "Applying Supabase migrations..."
    Invoke-Supabase db push
}

if (!$SkipFunctionDeploy) {
    Write-Host "Deploying ask-ai Edge Function..."
    Invoke-Supabase functions deploy ask-ai --no-verify-jwt

    Write-Host "Deploying livekit-token Edge Function..."
    Invoke-Supabase functions deploy livekit-token --no-verify-jwt

    Write-Host "Deploying music-proxy Edge Function..."
    Invoke-Supabase functions deploy music-proxy --no-verify-jwt
}

Write-Host "Supabase deployment flow complete."
