param(
    [switch]$SkipLogin,
    [switch]$SkipDbPush,
    [switch]$SkipFunctionDeploy
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

Write-Host "deploy_backend.ps1 is kept for compatibility. Forwarding to deploy_supabase.ps1..."
& "$PSScriptRoot/deploy_supabase.ps1" -SkipLogin:$SkipLogin -SkipDbPush:$SkipDbPush -SkipFunctionDeploy:$SkipFunctionDeploy
