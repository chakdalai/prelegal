"""Environment loading.

Only needed for local `uv run` invocations (cwd under backend/): the
repo-root .env is two directories up, above python-dotenv's default upward
search from cwd. In Docker, OPENROUTER_API_KEY etc. are already real
process env vars (passed via `docker run --env-file .env`) and no .env file
is present in the image, so load_dotenv here is a harmless no-op.
"""

from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


def load_env() -> None:
    load_dotenv(REPO_ROOT_ENV)
