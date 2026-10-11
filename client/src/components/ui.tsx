import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import clsx from "clsx";
import { Switch as RadixSwitch } from "radix-ui";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-[#0062c4] disabled:bg-[#c7c7cc]",
  secondary: "bg-white text-primary border border-line hover:bg-page disabled:text-ink-2",
  ghost: "text-primary hover:bg-primary/10 disabled:text-ink-2",
  danger: "bg-error text-white hover:bg-[#e0352b] disabled:bg-error/40",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; pending?: boolean }
>(function Button({ variant = "primary", size = "md", pending, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed",
        size === "md" ? "min-h-11 px-4 text-[15px]" : "min-h-10 px-3 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={clsx(
          "inline-flex size-11 items-center justify-center rounded-full text-primary hover:bg-primary/10 disabled:text-ink-2",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx("rounded-xl border border-black/5 bg-white p-4 shadow-sm", className)} {...rest} />;
}

export function CardHeader({ title, id, action, sub }: { title: ReactNode; id?: string; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {sub ? <p className="text-[13px] text-ink-2">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "error" | "offline" | "primary" | "success"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-page text-ink-2",
    error: "bg-error/10 text-[#d70015]",
    offline: "bg-offline/15 text-[#636366]",
    primary: "bg-primary/10 text-primary",
    success: "bg-type-security/15 text-[#248a3d]",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  pending,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled || pending}
      aria-label={label}
      aria-busy={pending || undefined}
      className={clsx(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors",
        "data-[state=checked]:bg-type-security data-[state=unchecked]:bg-[#e9e9eb]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Enlarge the hit area to 44px without changing the visual size.
        "before:absolute before:-inset-[7px] before:content-['']",
      )}
    >
      <RadixSwitch.Thumb className="block size-[27px] translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-[#d70015]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px] text-ink placeholder:text-ink-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-error";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={clsx(inputClass, className)} {...rest} />;
});

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(inputClass, "appearance-auto", className)} {...rest} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-lg bg-[#ececf0]", className)} />;
}

/** Visible explanation tied to a disabled control via aria-describedby. */
export function DisabledReason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-xs text-ink-2">
      {children}
    </p>
  );
}
