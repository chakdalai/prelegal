$ErrorActionPreference = "Stop"

docker stop prelegal 2>$null
docker rm prelegal 2>$null

Write-Host "Prelegal stopped."
