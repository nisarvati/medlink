import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type Tone = "neutral" | "brand" | "ok" | "warn" | "bad" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand-strong",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
};

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong hover:text-on-brand shadow-sm",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border border-line bg-surface text-bad hover:bg-bad-soft",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
};
const buttonClass = (variant: Variant, size: Size, extra?: string) =>
  cx(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
    VARIANT[variant],
    SIZE[size],
    extra,
  );

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  external,
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; variant?: Variant; size?: Size; external?: boolean }) {
  const cls = buttonClass(variant, size, className);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------- Display bits */

export function Badge({ tone = "neutral", className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span {...rest} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function Alert({ tone = "info", title, children, className, action }: { tone?: "info" | "ok" | "warn" | "bad"; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const Icon = tone === "ok" ? CheckIcon : tone === "info" ? InfoIcon : AlertIcon;
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl p-3.5 text-sm", TONE[tone], className)}>
      <Icon className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "opacity-95")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, level = 3 }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; level?: 1 | 2 | 3 }) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <Heading className="text-base font-semibold">{title}</Heading>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------- Forms */

const FIELD = "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/80 transition-colors hover:border-muted/60 focus:border-brand";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(FIELD, "h-11", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(FIELD, "h-10 cursor-pointer pr-8", className)}>
      {children}
    </select>
  );
}

/** A toggle that looks like a pill. Pressed state is announced, not only coloured. */
export function Chip({ pressed, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={pressed}
      className={cx(
        "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
        pressed ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The green pulse that says "this is live". */
export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("live-dot inline-block h-2 w-2 rounded-full bg-ok", className)} />;
}
