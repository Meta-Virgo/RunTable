param(
    [switch]$SkipLogin
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

Write-Host "update_db.ps1 is kept for compatibility. Forwarding to deploy_supabase.ps1..."
& "$PSScriptRoot/deploy_supabase.ps1" -SkipLogin:$SkipLogin -SkipFunctionDeploy
