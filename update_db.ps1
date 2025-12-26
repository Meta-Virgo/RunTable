$ErrorActionPreference = "Stop"

Write-Host "Checking Supabase CLI..."
if (!(Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "Supabase CLI not found in PATH. Using npx..."
    $SUPABASE_CMD = "npx supabase"
} else {
    $SUPABASE_CMD = "supabase"
}

Write-Host "Applying Database Migrations..."
Invoke-Expression "$SUPABASE_CMD db push"

Write-Host "✅ Database updated successfully!"
