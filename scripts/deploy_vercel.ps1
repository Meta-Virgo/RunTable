param(
    [string]$Project = "run-table",
    [string]$Scope = "meta-virgos-projects",
    [switch]$SkipLogin,
    [switch]$SkipEnvPull,
    [switch]$DeployProd
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

function Invoke-Vercel {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

    if (Get-Command vercel -ErrorAction SilentlyContinue) {
        & vercel @Args
    } else {
        & npx vercel @Args
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Vercel command failed: $($Args -join ' ')"
    }
}

if (!$SkipLogin) {
    Write-Host "Opening Vercel login if needed..."
    Invoke-Vercel login
}

Write-Host "Linking Vercel project $Scope/$Project..."
Invoke-Vercel link --yes --project $Project --scope $Scope

if (!$SkipEnvPull) {
    Write-Host "Pulling Vercel development environment into .env.local..."
    Invoke-Vercel env pull .env.local
}

Write-Host "Current Vercel environment variables:"
Invoke-Vercel env ls

if ($DeployProd) {
    Write-Host "Deploying to Vercel production..."
    Invoke-Vercel deploy --prod
} else {
    Write-Host "Linked Vercel project. Push to GitHub main or rerun with -DeployProd to deploy now."
}
