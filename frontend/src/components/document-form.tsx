"use client";

import { useId, type ReactNode } from "react";

import type { Party } from "@/lib/party";
import type { DocumentFormData } from "@/lib/documents/fields";
import type { DocumentConfig, FieldConfig } from "@/lib/documents/registry";

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

function DateField({ label, hint, value, onChange }: Omit<TextFieldProps, "placeholder" | "rows">) {
  const id = useId();

  return (
    <Field id={id} label={label} hint={hint}>
      <input
        id={id}
        className={INPUT_CLASS}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function DocumentField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "date") {
    return <DateField label={field.label} hint={field.helpText} value={value} onChange={onChange} />;
  }

  return (
    <TextField
      label={field.label}
      hint={field.helpText}
      rows={field.type === "textarea" ? 3 : undefined}
      value={value}
      onChange={onChange}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();

  return (
    <section
      className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/60 p-5"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PartyFields({ party, onChange }: { party: Party; onChange: (patch: Partial<Party>) => void }) {
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

export interface DocumentFormProps {
  config: DocumentConfig;
  data: DocumentFormData;
  onChange: (patch: Partial<DocumentFormData>) => void;
}

export function DocumentForm({ config, data, onChange }: DocumentFormProps) {
  const setValue = (name: string, value: string) =>
    onChange({ values: { ...data.values, [name]: value } });

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      {config.fields.length > 0 ? (
        <Section title="Agreement terms">
          {config.fields.map((field) => (
            <DocumentField
              key={field.name}
              field={field}
              value={data.values[field.name] ?? ""}
              onChange={(value) => setValue(field.name, value)}
            />
          ))}
        </Section>
      ) : null}

      <Section title={config.party1Label}>
        <PartyFields
          party={data.party1}
          onChange={(patch) => onChange({ party1: { ...data.party1, ...patch } })}
        />
      </Section>

      <Section title={config.party2Label}>
        <PartyFields
          party={data.party2}
          onChange={(patch) => onChange({ party2: { ...data.party2, ...patch } })}
        />
      </Section>
    </form>
  );
}
