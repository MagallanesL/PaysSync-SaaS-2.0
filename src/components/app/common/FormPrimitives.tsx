interface BaseFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="break-words text-text">{value}</p>
    </div>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-t border-slate-700 pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  min
}: BaseFieldProps & {
  type?: string;
  required?: boolean;
  min?: string | number;
}) {
  return (
    <label className="grid gap-1">
      {label}
      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
        required={required}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder
}: BaseFieldProps & {
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={placeholder}
        className="rounded-brand border border-slate-600 bg-bg px-3 py-2 outline-none focus:border-primary"
      />
    </label>
  );
}
