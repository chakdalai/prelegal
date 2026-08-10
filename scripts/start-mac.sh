#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t prelegal:latest .
docker rm -f prelegal >/dev/null 2>&1 || true

# --env-file passes OPENROUTER_API_KEY (used by the Mutual NDA chat) into the
# container; the .env file itself is never baked into the image. Its absence
# doesn't stop the rest of the app from working.
#
# Not an array + "${arr[@]}": under `set -u`, expanding an empty array this
# way is an "unbound variable" error on bash < 4.4 — notably the bash 3.2
# that ships as /usr/bin/bash on macOS — which would abort the script
# whenever .env is missing, the opposite of "doesn't stop the app".
if [[ -f .env ]]; then
  docker run -d --name prelegal -p 8000:8000 --env-file .env prelegal:latest
else
  docker run -d --name prelegal -p 8000:8000 prelegal:latest
fi

echo "Prelegal is running at http://localhost:8000"
