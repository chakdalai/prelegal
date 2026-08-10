$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

docker build -t prelegal:latest .
docker rm -f prelegal 2>$null
docker run -d --name prelegal -p 8000:8000 prelegal:latest

Write-Host "Prelegal is running at http://localhost:8000"
