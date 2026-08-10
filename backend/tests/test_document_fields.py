import json
from pathlib import Path

import pytest

from app.document_fields import (
    fields_model,
    fields_patch_model,
    load_document_config,
    load_document_configs,
    merge_patch,
    turn_result_model,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_loads_a_config_for_every_non_mutual_nda_catalog_document():
    catalog = json.loads((REPO_ROOT / "catalog.json").read_text())
    non_nda_filenames = {
        entry["filename"]
        for entry in catalog
        if entry["filename"] not in {"mutual-nda-coverpage.md", "mutual-nda.md"}
    }

    configs = load_document_configs()

    assert {config.filename for config in configs} == non_nda_filenames


def test_every_config_points_at_a_real_template():
    for config in load_document_configs():
        assert (REPO_ROOT / "templates" / config.filename).is_file()


@pytest.mark.parametrize("config", load_document_configs(), ids=lambda c: c.slug)
def test_full_and_patch_models_round_trip_every_field(config):
    fields_cls = fields_model(config.slug)
    empty_party = {"company": "", "signatoryName": "", "signatoryTitle": "", "noticeAddress": ""}

    current = fields_cls(
        values={field.name: "" for field in config.fields},
        party1=empty_party,
        party2=empty_party,
    )

    patch_cls = fields_patch_model(config.slug)
    patch_values = {field.name: f"value for {field.name}" for field in config.fields}
    patch = patch_cls(values=patch_values, party1={"company": "Acme, Inc."})

    merged = merge_patch(config.slug, current, patch)

    for field in config.fields:
        assert getattr(merged.values, field.name) == f"value for {field.name}"
    assert merged.party1.company == "Acme, Inc."
    assert merged.party2.company == ""


@pytest.mark.parametrize("config", load_document_configs(), ids=lambda c: c.slug)
def test_merge_patch_with_no_changes_keeps_everything(config):
    fields_cls = fields_model(config.slug)
    empty_party = {"company": "", "signatoryName": "", "signatoryTitle": "", "noticeAddress": ""}
    current = fields_cls(
        values={field.name: "known" for field in config.fields},
        party1=empty_party,
        party2=empty_party,
    )

    patch_cls = fields_patch_model(config.slug)
    merged = merge_patch(config.slug, current, patch_cls())

    assert merged == current


@pytest.mark.parametrize("config", load_document_configs(), ids=lambda c: c.slug)
def test_turn_result_schema_has_no_discriminator_or_oneof(config):
    # Cerebras's Structured Outputs support rejects `discriminator`/`oneOf` in
    # the JSON schema (see CLAUDE.md's AI design notes) — every dynamically
    # built model here is flat, so this should never trip.
    schema = json.dumps(turn_result_model(config.slug).model_json_schema())

    assert "discriminator" not in schema
    assert "oneOf" not in schema


def test_load_document_config_returns_none_for_an_unknown_slug():
    assert load_document_config("not-a-real-document") is None
