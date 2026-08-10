$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

docker build -t prelegal:latest .
docker rm -f prelegal 2>$null

# --env-file passes OPENROUTER_API_KEY (used by the Mutual NDA chat) into the
# container; the .env file itself is never baked into the image. Its absence
# doesn't stop the rest of the app from working.
$EnvFlags = @()
if (Test-Path .env) { $EnvFlags = @("--env-file", ".env") }

docker run -d --name prelegal -p 8000:8000 @EnvFlags prelegal:latest

Write-Host "Prelegal is running at http://localhost:8000"
