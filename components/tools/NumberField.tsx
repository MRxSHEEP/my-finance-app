"use client";

export default function NumberField({
  label,
  value,
  onChange,
  helperText,
  suffix,
  prefix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 focus-within:border-black/30 dark:border-white/15 dark:focus-within:border-white/30">
        {prefix && <span className="text-sm text-foreground/60">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none"
        />
        {suffix && <span className="text-sm text-foreground/60">{suffix}</span>}
      </div>
      {helperText && <span className="text-xs text-foreground/60">{helperText}</span>}
    </label>
  );
}
