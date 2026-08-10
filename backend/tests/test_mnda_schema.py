from app.mnda_schema import (
    MndaFields,
    MndaFieldsPatch,
    Party,
    PartyPatch,
    merge_patch,
)


def make_fields(**overrides) -> MndaFields:
    defaults = dict(
        purpose="Evaluate a deal.",
        effectiveDate="2026-01-01",
        mndaTerm={"kind": "expires", "years": 1},
        confidentialityTerm={"kind": "years", "years": 1},
        governingLaw="Delaware",
        jurisdiction="New Castle, DE",
        modifications="",
        party1=Party(
            company="Acme, Inc.",
            signatoryName="Ada Lovelace",
            signatoryTitle="CEO",
            noticeAddress="legal@acme.example",
        ),
        party2=Party(
            company="", signatoryName="", signatoryTitle="", noticeAddress=""
        ),
    )
    defaults.update(overrides)
    return MndaFields(**defaults)


def test_merge_patch_with_no_changes_keeps_everything():
    current = make_fields()
    merged = merge_patch(current, MndaFieldsPatch())

    assert merged == current


def test_merge_patch_replaces_only_the_addressed_scalar_field():
    current = make_fields()
    merged = merge_patch(current, MndaFieldsPatch(jurisdiction="Wilmington, DE"))

    assert merged.jurisdiction == "Wilmington, DE"
    assert merged.governingLaw == current.governingLaw
    assert merged.purpose == current.purpose


def test_merge_patch_replaces_discriminated_union_wholesale():
    current = make_fields()
    merged = merge_patch(
        current, MndaFieldsPatch(mndaTerm={"kind": "untilTerminated"})
    )

    assert merged.mndaTerm.kind == "untilTerminated"
    assert merged.confidentialityTerm == current.confidentialityTerm


def test_merge_patch_updates_one_party_field_without_clearing_the_others():
    current = make_fields()
    merged = merge_patch(
        current,
        MndaFieldsPatch(party2=PartyPatch(company="Beta LLC")),
    )

    assert merged.party2.company == "Beta LLC"
    assert merged.party2.signatoryName == ""
    assert merged.party1 == current.party1
