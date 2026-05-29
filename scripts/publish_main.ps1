param(
    [Parameter(Mandatory = $true)]
    [string]$Message,

    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command"
    }
}

if (!(git rev-parse --is-inside-work-tree 2>$null)) {
    throw "This directory is not a Git repository."
}

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
    throw "publish_main.ps1 must be run from main. Current branch: $branch"
}

Write-Host "Fetching latest origin/main..."
Invoke-Checked { git fetch origin main }

$local = (git rev-parse main).Trim()
$remote = (git rev-parse origin/main).Trim()
$base = (git merge-base main origin/main).Trim()

if ($local -ne $remote) {
    if ($local -eq $base) {
        Write-Host "Fast-forwarding main to origin/main..."
        Invoke-Checked { git merge --ff-only origin/main }
    } elseif ($remote -ne $base) {
        throw "main and origin/main have diverged. Resolve manually before publishing."
    }
}

if (!$SkipBuild) {
    Write-Host "Running production build..."
    Invoke-Checked { npm run build }
}

Invoke-Checked { git add -A }

$changes = git status --porcelain
if (!$changes) {
    Write-Host "No changes to publish."
    exit 0
}

Write-Host "Committing changes..."
Invoke-Checked { git commit -m $Message }

Write-Host "Pushing to origin/main..."
Invoke-Checked { git push origin main }

Write-Host "Published to GitHub main."
