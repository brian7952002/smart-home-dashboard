import type { LucideIcon } from "lucide-react";

export function IconPicker<K extends string>({
  name,
  value,
  onChange,
  options,
  error,
}: {
  name: string;
  value: K | "";
  onChange: (v: K) => void;
  options: Record<K, { label: string; icon: LucideIcon }>;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">Icon</legend>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(options) as K[]).map((key) => {
          const { label, icon: Icon } = options[key];
          return (
            <label
              key={key}
              className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-line text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
            >
              <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} className="sr-only" />
              <Icon className="size-6" aria-hidden />
              {label}
            </label>
          );
        })}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-[#d70015]">{error}</p> : null}
    </fieldset>
  );
}
