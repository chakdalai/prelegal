"""Pydantic mirror of `frontend/src/lib/mnda/fields.ts`'s `MndaFormData`.

Field names are kept camelCase (not the usual snake_case) so the JSON wire
shape is a byte-exact match for the frontend type — no alias generator
needed, and no risk of it interacting oddly with LiteLLM's JSON-schema
generation for Structured Outputs.

Two shapes exist for the same data:
- `MndaFields`: a full snapshot, every field required. This is what the
  frontend sends as the current state and what the API returns.
- `MndaFieldsPatch`: every field optional/`None`. This is what the LLM
  produces for a single turn — `None` means "not addressed this turn",
  distinct from an empty string, which would mean "the user said this is
  blank". Never sent to the frontend; `merge_patch` consumes it internally.
"""

from typing import Literal, Optional

from pydantic import BaseModel


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


class MndaTerm(BaseModel):
    """Mirrors the TS discriminated union `{kind: "expires", years} |
    {kind: "untilTerminated"}` as a flat, optional-field shape instead: a
    `oneOf`/discriminated union in the JSON schema is rejected by Cerebras's
    Structured Outputs support ("Unsupported JSON schema fields ...
    discriminator, oneOf"). `years` is only meaningful when
    `kind == "expires"`; the frontend already ignores it otherwise.
    """

    kind: Literal["expires", "untilTerminated"]
    years: Optional[int] = None


class ConfidentialityTerm(BaseModel):
    """As {@link MndaTerm}, flattened for the same reason. `years` is only
    meaningful when `kind == "years"`.
    """

    kind: Literal["years", "perpetual"]
    years: Optional[int] = None


class MndaFields(BaseModel):
    purpose: str
    effectiveDate: str
    mndaTerm: MndaTerm
    confidentialityTerm: ConfidentialityTerm
    governingLaw: str
    jurisdiction: str
    modifications: str
    party1: Party
    party2: Party


class MndaFieldsPatch(BaseModel):
    purpose: Optional[str] = None
    effectiveDate: Optional[str] = None
    mndaTerm: Optional[MndaTerm] = None
    confidentialityTerm: Optional[ConfidentialityTerm] = None
    governingLaw: Optional[str] = None
    jurisdiction: Optional[str] = None
    modifications: Optional[str] = None
    party1: Optional[PartyPatch] = None
    party2: Optional[PartyPatch] = None


class MndaTurnResult(BaseModel):
    """The Structured Outputs response shape for one chat turn."""

    reply: str
    patch: MndaFieldsPatch


def _merge_party(current: Party, patch: Optional[PartyPatch]) -> Party:
    if patch is None:
        return current
    return Party(
        company=patch.company if patch.company is not None else current.company,
        signatoryName=(
            patch.signatoryName if patch.signatoryName is not None else current.signatoryName
        ),
        signatoryTitle=(
            patch.signatoryTitle
            if patch.signatoryTitle is not None
            else current.signatoryTitle
        ),
        noticeAddress=(
            patch.noticeAddress if patch.noticeAddress is not None else current.noticeAddress
        ),
    )


def merge_patch(current: MndaFields, patch: MndaFieldsPatch) -> MndaFields:
    """Apply a patch onto a snapshot: a `None` field keeps the current value,
    any other value replaces it. `mndaTerm`/`confidentialityTerm` replace
    wholesale when present — a discriminated union can't be partially
    updated. Pure and deterministic.
    """
    return MndaFields(
        purpose=patch.purpose if patch.purpose is not None else current.purpose,
        effectiveDate=(
            patch.effectiveDate if patch.effectiveDate is not None else current.effectiveDate
        ),
        mndaTerm=patch.mndaTerm if patch.mndaTerm is not None else current.mndaTerm,
        confidentialityTerm=(
            patch.confidentialityTerm
            if patch.confidentialityTerm is not None
            else current.confidentialityTerm
        ),
        governingLaw=(
            patch.governingLaw if patch.governingLaw is not None else current.governingLaw
        ),
        jurisdiction=(
            patch.jurisdiction if patch.jurisdiction is not None else current.jurisdiction
        ),
        modifications=(
            patch.modifications if patch.modifications is not None else current.modifications
        ),
        party1=_merge_party(current.party1, patch.party1),
        party2=_merge_party(current.party2, patch.party2),
    )
