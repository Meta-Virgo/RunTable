$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

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

Write-Host "Checking local toolchain..."
Assert-Command git
Assert-Command node
Assert-Command npm

Write-Host "Installing dependencies..."
Invoke-Checked { npm install }

if (!(Test-Path ".env.example")) {
    throw ".env.example is missing."
}

if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example. Fill in the real values before running the app."
} else {
    Write-Host ".env already exists; leaving it unchanged."
}

Write-Host "Local setup complete. Run: npm run dev"
