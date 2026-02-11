$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."


Write-Host "Checking Supabase CLI..."
if (!(Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "Supabase CLI not found in PATH. Using npx..."
    $SUPABASE_CMD = "npx supabase"
} else {
    $SUPABASE_CMD = "supabase"
}

Write-Host "1. Logging in to Supabase (Interactive)..."
Write-Host "If a browser opens, please confirm the login."
Invoke-Expression "$SUPABASE_CMD login"

Write-Host "`n2. Linking Project..."
# Project ID extracted from URL: https://otvlvdjjtuhobeslcvwr.supabase.co
$PROJECT_ID = "otvlvdjjtuhobeslcvwr"
# Try linking. If already linked, it might prompt or fail, so we accept failure if it's just 'already linked' but we use --project-ref to be sure
# Note: linking might ask for DB password if not using access token. 
# We assume the login above handles auth.
Invoke-Expression "$SUPABASE_CMD link --project-ref $PROJECT_ID"

Write-Host "`n3. Setting Secrets (DeepSeek API Key)..."
$API_KEY = "sk-54bbf491f30349e084c05b126db6947c"
Invoke-Expression "$SUPABASE_CMD secrets set DEEPSEEK_API_KEY=$API_KEY"

Write-Host "`n4. Deploying Edge Function..."
Invoke-Expression "$SUPABASE_CMD functions deploy ask-ai --no-verify-jwt"

Write-Host "`n✅ Deployment Complete! The AI feature is now ready to use."
