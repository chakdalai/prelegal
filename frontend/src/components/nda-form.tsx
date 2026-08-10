"use client";

import { useId, useState, type ReactNode } from "react";

import type { MndaFormData, Party } from "@/lib/mnda/fields";

const INPUT_CLASS =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 " +
  "shadow-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}

function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-stone-800" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
      {children}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  /** Renders a textarea of this height instead of a single-line input. */
  rows?: number;
  onChange: (value: string) => void;
}

function TextField({ label, hint, value, placeholder, rows, onChange }: TextFieldProps) {
  const id = useId();

  return (
    <Field id={id} label={label} hint={hint}>
      {rows ? (
        <textarea
          id={id}
          className={INPUT_CLASS}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className={INPUT_CLASS}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

interface ChoiceProps {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function Choice({ name, checked, onSelect, children }: ChoiceProps) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-stone-700">
      <input
        className="mt-0.5 accent-stone-700"
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
      />
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </label>
  );
}

function YearsInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (years: number) => void;
}) {
  /**
   * While the field has focus the user's raw text is shown, so that clearing it
   * to type a new number does not immediately snap to a valid value and leave
   * the next keystroke appended to it. Only values in range are committed, and
   * blurring discards anything half-typed.
   */
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      className="w-16 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm disabled:bg-stone-100 disabled:text-stone-400"
      type="number"
      min={1}
      max={99}
      value={draft ?? value}
      disabled={disabled}
      aria-label="Number of years"
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);

        // `min`/`max` are not enforced while typing, so out-of-range and
        // half-typed values are simply not committed.
        const years = Number(raw);
        if (Number.isInteger(years) && years >= 1 && years <= 99) onChange(years);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  // Naming the section makes it a landmark, so the form can be navigated
  // section by section rather than as one long run of fields.
  const headingId = useId();

  return (
    <section
      className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/60 p-5"
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className="text-sm font-semibold uppercase tracking-wide text-stone-500"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function PartyFields({
  party,
  onChange,
}: {
  party: Party;
  onChange: (patch: Partial<Party>) => void;
}) {
  return (
    <div className="space-y-4">
      <TextField
        label="Company"
        value={party.company}
        placeholder="Acme, Inc."
        onChange={(company) => onChange({ company })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Print name"
          value={party.signatoryName}
          placeholder="Ada Lovelace"
          onChange={(signatoryName) => onChange({ signatoryName })}
        />
        <TextField
          label="Title"
          value={party.signatoryTitle}
          placeholder="Chief Executive Officer"
          onChange={(signatoryTitle) => onChange({ signatoryTitle })}
        />
      </div>
      <TextField
        label="Notice address"
        hint="Either an email or a postal address."
        rows={2}
        value={party.noticeAddress}
        placeholder="legal@acme.example"
        onChange={(noticeAddress) => onChange({ noticeAddress })}
      />
    </div>
  );
}

/** Today in the browser's own time zone, as `yyyy-mm-dd`. */
function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

export interface NdaFormProps {
  data: MndaFormData;
  onChange: (patch: Partial<MndaFormData>) => void;
}

export function NdaForm({ data, onChange }: NdaFormProps) {
  const effectiveDateId = useId();
  const { mndaTerm, confidentialityTerm } = data;

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <Section title="Agreement terms">
        <TextField
          label="Purpose"
          hint="How Confidential Information may be used."
          rows={3}
          value={data.purpose}
          onChange={(purpose) => onChange({ purpose })}
        />

        <Field id={effectiveDateId} label="Effective date">
          <div className="flex items-center gap-2">
            <input
              id={effectiveDateId}
              className={INPUT_CLASS}
              type="date"
              value={data.effectiveDate}
              onChange={(event) => onChange({ effectiveDate: event.target.value })}
            />
            <button
              className="shrink-0 rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
              type="button"
              onClick={() => onChange({ effectiveDate: todayIso() })}
            >
              Today
            </button>
          </div>
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-800">MNDA term</legend>
          <p className="text-xs text-stone-500">The length of this MNDA.</p>
          <Choice
            name="mnda-term"
            checked={mndaTerm.kind === "expires"}
            onSelect={() => onChange({ mndaTerm: { kind: "expires", years: 1 } })}
          >
            Expires
            <YearsInput
              value={mndaTerm.kind === "expires" ? mndaTerm.years : 1}
              disabled={mndaTerm.kind !== "expires"}
              onChange={(years) => onChange({ mndaTerm: { kind: "expires", years } })}
            />
            year(s) from the effective date.
          </Choice>
          <Choice
            name="mnda-term"
            checked={mndaTerm.kind === "untilTerminated"}
            onSelect={() => onChange({ mndaTerm: { kind: "untilTerminated" } })}
          >
            Continues until terminated.
          </Choice>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-800">Term of confidentiality</legend>
          <p className="text-xs text-stone-500">
            How long Confidential Information is protected.
          </p>
          <Choice
            name="confidentiality-term"
            checked={confidentialityTerm.kind === "years"}
            onSelect={() => onChange({ confidentialityTerm: { kind: "years", years: 1 } })}
          >
            <YearsInput
              value={confidentialityTerm.kind === "years" ? confidentialityTerm.years : 1}
              disabled={confidentialityTerm.kind !== "years"}
              onChange={(years) => onChange({ confidentialityTerm: { kind: "years", years } })}
            />
            year(s) from the effective date, except trade secrets.
          </Choice>
          <Choice
            name="confidentiality-term"
            checked={confidentialityTerm.kind === "perpetual"}
            onSelect={() => onChange({ confidentialityTerm: { kind: "perpetual" } })}
          >
            In perpetuity.
          </Choice>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Governing law"
            hint="The state whose law applies."
            value={data.governingLaw}
            placeholder="Delaware"
            onChange={(governingLaw) => onChange({ governingLaw })}
          />
          <TextField
            label="Jurisdiction"
            hint="City or county, and state."
            value={data.jurisdiction}
            placeholder="New Castle, DE"
            onChange={(jurisdiction) => onChange({ jurisdiction })}
          />
        </div>

        <TextField
          label="Modifications"
          hint="Optional. Changes here control over the standard terms."
          rows={2}
          value={data.modifications}
          placeholder="None."
          onChange={(modifications) => onChange({ modifications })}
        />
      </Section>

      <Section title="Party 1">
        <PartyFields
          party={data.party1}
          onChange={(patch) => onChange({ party1: { ...data.party1, ...patch } })}
        />
      </Section>

      <Section title="Party 2">
        <PartyFields
          party={data.party2}
          onChange={(patch) => onChange({ party2: { ...data.party2, ...patch } })}
        />
      </Section>
    </form>
  );
}
