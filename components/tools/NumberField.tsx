"use client";

import { AlertCircle } from "lucide-react";

export default function NumberField({
  label,
  value,
  onChange,
  helperText,
  suffix,
  prefix,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  // Caller-computed validation message (e.g. "must be positive") — this
  // component just renders the error state; each calculator knows its own
  // domain rules (a negative discount rate is invalid, a negative cash
  // balance in a debt calculator might be fine, etc.), so validation logic
  // stays in the page rather than being guessed at generically here.
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div
        className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-150 ease-out ${
          error
            ? "border-red-500/50 focus-within:border-red-500"
            : "border-black/10 focus-within:border-black/30 dark:border-white/15 dark:focus-within:border-white/30"
        }`}
      >
        {prefix && <span className="text-sm text-foreground/60">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="w-full bg-transparent text-sm outline-none"
        />
        {suffix && <span className="text-sm text-foreground/60">{suffix}</span>}
      </div>
      {error ? (
        <span className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={12} className="shrink-0" /> {error}
        </span>
      ) : (
        helperText && <span className="text-xs text-foreground/60">{helperText}</span>
      )}
    </label>
  );
}
