"""Generic field configs and dynamically-built Pydantic models for the eleven
catalog documents that aren't the Mutual NDA — see `mnda_schema.py` for that
one, which keeps its own hand-typed models rather than being folded into this
generic shape (CLAUDE.md's AI chat design notes explain why).

`document-fields/*.json` at the repo root is the single source of truth for
each document's fields (name, label, type). This module turns that config
into the same two shapes `mnda_schema.py` hand-writes for the Mutual NDA:
- a `Fields` model (every field required — the frontend's current snapshot
  and the API's response)
- a `FieldsPatch` model (every field optional/`None` — one chat turn's
  Structured Outputs response; `None` means "not addressed this turn")

Models are built once per slug and cached, since `create_model` isn't free
and the field set never changes at runtime.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, create_model

# `parents[2]` reaches the repo root only in local dev (`backend/app/` is two
# levels under it); the Docker image copies just `backend/app` into `/app/app`
# without the rest of the repo's layout, so `PRELEGAL_DOCUMENT_FIELDS_DIR`
# overrides it there — the same pattern as `PRELEGAL_STATIC_DIR`/
# `PRELEGAL_DB_PATH` in `main.py`.
DOCUMENT_FIELDS_DIR = Path(
    os.environ.get("PRELEGAL_DOCUMENT_FIELDS_DIR")
    or Path(__file__).resolve().parents[2] / "document-fields"
)


class FieldConfig(BaseModel):
    name: str
    label: str
    type: str
    helpText: Optional[str] = None


class DocumentConfig(BaseModel):
    slug: str
    filename: str
    title: str
    party1Label: str
    party2Label: str
    fields: list[FieldConfig]


class Party(BaseModel):
    company: str
    signatoryName: str
    signatoryTitle: str
    noticeAddress: str


class PartyPatch(BaseModel):
    company: Optional[str] = None
    signatoryName: Optional[str] = None
    signatoryTitle: Optional[str] = None
    noticeAddress: Optional[str] = None


@lru_cache(maxsize=None)
def _load_all_configs() -> tuple[DocumentConfig, ...]:
    configs = []
    for path in sorted(DOCUMENT_FIELDS_DIR.glob("*.json")):
        configs.append(DocumentConfig.model_validate_json(path.read_text()))
    return tuple(configs)


def load_document_configs() -> list[DocumentConfig]:
    return list(_load_all_configs())


def load_document_config(slug: str) -> Optional[DocumentConfig]:
    for config in _load_all_configs():
        if config.slug == slug:
            return config
    return None


@lru_cache(maxsize=None)
def _build_models(slug: str) -> tuple[type[BaseModel], type[BaseModel]]:
    config = load_document_config(slug)
    if config is None:
        raise KeyError(f"no document config for slug {slug!r}")

    values_fields = {field.name: (str, ...) for field in config.fields}
    values_patch_fields = {field.name: (Optional[str], None) for field in config.fields}

    values_model = create_model(f"Values_{slug}", **values_fields)
    values_patch_model = create_model(f"ValuesPatch_{slug}", **values_patch_fields)

    fields_model = create_model(
        f"Fields_{slug}",
        values=(values_model, ...),
        party1=(Party, ...),
        party2=(Party, ...),
    )
    fields_patch_model = create_model(
        f"FieldsPatch_{slug}",
        values=(Optional[values_patch_model], None),
        party1=(Optional[PartyPatch], None),
        party2=(Optional[PartyPatch], None),
    )

    return fields_model, fields_patch_model


def fields_model(slug: str) -> type[BaseModel]:
    """The full-snapshot model for a document: every field required."""
    return _build_models(slug)[0]


def fields_patch_model(slug: str) -> type[BaseModel]:
    """The one-turn patch model for a document: every field optional."""
    return _build_models(slug)[1]


@lru_cache(maxsize=None)
def turn_result_model(slug: str) -> type[BaseModel]:
    """The Structured Outputs response shape for one chat turn on this document."""
    return create_model(
        f"TurnResult_{slug}",
        reply=(str, ...),
        patch=(fields_patch_model(slug), ...),
    )


def _merge_party(current: Party, patch: Optional[PartyPatch]) -> Party:
    if patch is None:
        return current

    data = current.model_dump()
    for key, value in patch.model_dump().items():
        if value is not None:
            data[key] = value
    return Party(**data)


def merge_patch(slug: str, current: BaseModel, patch: BaseModel) -> BaseModel:
    """Apply a patch onto a snapshot: a `None` field keeps the current value,
    any other value replaces it. Generalizes `mnda_schema.py::merge_patch` to
    a dynamically-shaped `values` object instead of hand-listed fields. Pure
    and deterministic.
    """
    fields_cls = fields_model(slug)

    values = current.values.model_dump()
    if patch.values is not None:
        for key, value in patch.values.model_dump().items():
            if value is not None:
                values[key] = value

    return fields_cls(
        values=values,
        party1=_merge_party(current.party1, patch.party1),
        party2=_merge_party(current.party2, patch.party2),
    )
