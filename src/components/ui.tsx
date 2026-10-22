"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  EyeOff,
  Info,
  KeyRound,
  LoaderCircle,
  Lock,
  Network,
  Server,
  ShieldX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { STAGES, type Stage } from "@/lib/veil";

export function cx(...c: (string | number | false | null | undefined)[]) {
  return c.filter((x) => typeof x === "string" && x).join(" ");
}

/* ───────────────────────── buttons ───────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_1px_2px_rgb(21_38_59/0.16)] hover:bg-accent-hover",
  secondary: "bg-surface text-ink ring-1 ring-line shadow-[0_1px_2px_rgb(21_38_59/0.04)] hover:bg-canvas hover:ring-ink-4/50",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-deny ring-1 ring-deny/25 hover:bg-deny-soft",
};
const SIZES = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-9 px-3.5 text-[13px] gap-2", lg: "h-11 px-4.5 text-sm gap-2" };

export function Button({
  variant = "primary",
  size = "md",
  busy,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[7px] font-medium whitespace-nowrap transition-[background,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {busy && <LoaderCircle className="size-3.5 animate-spin" strokeWidth={1.5} />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  children,
  className,
  arrow,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  children: ReactNode;
  className?: string;
  arrow?: boolean;
}) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors duration-150", SIZES[size], VARIANTS[variant], className)}>
      {children}
      {arrow && <ArrowRight className="size-3.5" strokeWidth={1.5} />}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx("size-4 animate-spin", className)} strokeWidth={1.7} />;
}

/* ───────────────────────── containers ───────────────────────── */

export function Card({
  children,
  className,
  title,
  action,
  subtitle,
  flush,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={cx("rounded-[10px] bg-surface ring-1 ring-line shadow-[0_1px_2px_rgb(21_38_59/0.035)]", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-line-2 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-line-2 pb-5">
      <div className="max-w-3xl">
        <h1 className="text-[25px] leading-tight font-semibold tracking-[-0.035em] text-balance text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-pretty text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** One compact strip of figures. Deliberately not a row of big-number cards. */
export function Metrics({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <dl className="mb-7 grid grid-cols-2 overflow-hidden rounded-[10px] bg-surface ring-1 ring-line md:grid-cols-4">
      {items.map((m, i) => (
        <div key={m.label} className={cx("px-4 py-3.5", i > 0 && "border-line-2 md:border-l", i % 2 === 1 && "border-l", i >= 2 && "border-t md:border-t-0")}>
          <dt className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">{m.label}</dt>
          <dd className="tabular mt-1 text-[21px] font-semibold tracking-[-0.04em] text-ink">{m.value}</dd>
          {m.hint && <dd className="mt-0.5 text-xs text-ink-4">{m.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Empty({ title, children, icon: Icon = Info }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-dashed border-line bg-surface px-6 py-14 text-center">
      <Icon className="size-5 text-ink-4" strokeWidth={1.5} />
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}

/* ───────────────────────── tables ───────────────────────── */

export const th = "h-9 px-4 text-left text-xs font-medium text-ink-3 whitespace-nowrap";
export const td = "px-4 py-2.5 align-middle";
export const tr = "border-t border-line-2 transition-colors hover:bg-canvas/70";

/* ───────────────────────── badges & state ───────────────────────── */

type Tone = "neutral" | "accent" | "seal" | "deny" | "grant" | "final" | "quorum" | "warn";
const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 ring-line",
  accent: "bg-accent-soft text-accent ring-accent/15",
  seal: "bg-seal-soft text-seal ring-seal/20",
  deny: "bg-deny-soft text-deny ring-deny/20",
  grant: "bg-grant-soft text-grant ring-grant/20",
  final: "bg-final-soft text-final ring-final/20",
  quorum: "bg-quorum-soft text-quorum ring-quorum/20",
  warn: "bg-warn-soft text-warn ring-warn/20",
};

export function Badge({ tone = "neutral", children, className, icon: Icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>
      {Icon && <Icon className="size-3" strokeWidth={1.5} />}
      {children}
    </span>
  );
}

const STAGE_DOT: Record<Stage, string> = {
  DRAFT: "border-ink-4",
  OPEN: "border-accent bg-accent",
  REVIEW: "border-warn bg-[conic-gradient(var(--color-warn)_0_50%,transparent_50%)]",
  FINALIZED: "border-final bg-[conic-gradient(var(--color-final)_0_75%,transparent_75%)]",
  DISCLOSURE: "border-grant bg-grant",
  CLOSED: "border-ink-4 bg-ink-4",
};
export function stageLabel(s: Stage) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
/** Linear-style status: a small drawn dot whose fill encodes progress, plus the word. */
export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2">
      <span className={cx("inline-block size-3 rounded-full border-[1.5px]", STAGE_DOT[stage])} />
      {stageLabel(stage)}
    </span>
  );
}

export function StageStepper({ stage }: { stage: Stage }) {
  const at = STAGES.indexOf(stage);
  return (
    <ol className="flex w-full items-center">
      {STAGES.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span
              className={cx(
                "grid size-5 place-items-center rounded-full text-[11px] font-semibold",
                i < at && "bg-ink text-white",
                i === at && "bg-accent text-white ring-4 ring-accent-soft",
                i > at && "bg-surface text-ink-4 ring-1 ring-line",
              )}
            >
              {i < at ? <CircleCheck className="size-3" strokeWidth={1.5} /> : i + 1}
            </span>
            <span className={cx("text-[13px]", i === at ? "font-semibold text-ink" : i < at ? "text-ink-2" : "text-ink-4")}>{stageLabel(s)}</span>
          </span>
          {i < STAGES.length - 1 && <span className={cx("mx-3 h-px flex-1", i < at ? "bg-ink/40" : "bg-line")} />}
        </li>
      ))}
    </ol>
  );
}

/* Signature move: every security outcome names the layer that decided it. */
export type EnforcerKind = "tide" | "quorum" | "veil";
const ENFORCER: Record<EnforcerKind, { label: string; icon: LucideIcon; cls: string }> = {
  tide: { label: "Tide network", icon: Network, cls: "text-seal ring-seal/25 bg-surface" },
  quorum: { label: "TideCloak quorum", icon: Users, cls: "text-quorum ring-quorum/25 bg-surface" },
  veil: { label: "VEIL server", icon: Server, cls: "text-ink-3 ring-line bg-sunken" },
};
/** compact: icon-only disc for dense rows; the label stays available to screen readers and on hover. */
export function Enforcer({ by, className, compact }: { by: EnforcerKind; className?: string; compact?: boolean }) {
  const e = ENFORCER[by];
  if (compact) {
    return (
      <span title={`Enforced by: ${e.label}`} aria-label={`Enforced by ${e.label}`} className={cx("inline-grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-inset", e.cls, className)}>
        <e.icon className="size-3" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span
      title={`Enforced by: ${e.label}`}
      className={cx("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", e.cls, className)}
    >
      <e.icon className="size-3" strokeWidth={1.5} />
      {e.label}
    </span>
  );
}

export type SecurityKind = "sealed" | "denied" | "finalized" | "authorized";
const SECURITY: Record<SecurityKind, { label: string; icon: LucideIcon; tone: Tone }> = {
  sealed: { label: "Identity sealed", icon: Lock, tone: "seal" },
  denied: { label: "Access denied", icon: ShieldX, tone: "deny" },
  finalized: { label: "Evaluation finalized", icon: BadgeCheck, tone: "final" },
  authorized: { label: "Disclosure authorized", icon: KeyRound, tone: "grant" },
};
export function SecurityState({ kind, label, by, compact }: { kind: SecurityKind; label?: string; by?: EnforcerKind; compact?: boolean }) {
  const s = SECURITY[kind];
  const badge = (
    <Badge tone={s.tone} icon={s.icon}>
      {label ?? s.label}
    </Badge>
  );
  if (!by) return badge;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {badge}
      <Enforcer by={by} compact={compact} />
    </span>
  );
}

type NoticeKind = "protected" | "denied" | "finalized" | "authorized" | "info" | "warn";
const NOTICE: Record<NoticeKind, { box: string; icon: LucideIcon; title: string }> = {
  protected: { box: "bg-seal-soft ring-seal/20", icon: Lock, title: "text-seal" },
  denied: { box: "bg-deny-soft ring-deny/20", icon: ShieldX, title: "text-deny" },
  finalized: { box: "bg-final-soft ring-final/20", icon: BadgeCheck, title: "text-final" },
  authorized: { box: "bg-grant-soft ring-grant/20", icon: KeyRound, title: "text-grant" },
  info: { box: "bg-canvas ring-line", icon: Info, title: "text-ink" },
  warn: { box: "bg-warn-soft ring-warn/20", icon: CircleAlert, title: "text-warn" },
};

export function Notice({ kind, title, children, className, by }: { kind: NoticeKind; title: ReactNode; children?: ReactNode; className?: string; by?: EnforcerKind }) {
  const n = NOTICE[kind];
  return (
    <div role={kind === "denied" ? "alert" : undefined} className={cx("flex gap-3 rounded-lg px-3.5 py-3 ring-1 ring-inset", n.box, className)}>
      <n.icon className={cx("mt-0.5 size-4 shrink-0", n.title)} strokeWidth={1.5} />
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cx("font-semibold", n.title)}>{title}</p>
          {by && <Enforcer by={by} />}
        </div>
        {children && <div className="mt-1 leading-relaxed text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

/** Raw text returned by the Tide network or the API, shown verbatim. */
export function RawDetail({ children, label = "Technical detail" }: { children: ReactNode; label?: string }) {
  return (
    <details className="mt-2 group">
      <summary className="cursor-pointer text-xs font-medium text-ink-3 select-none hover:text-ink-2">{label}</summary>
      <pre className="mt-1.5 max-h-44 overflow-auto rounded-md bg-surface/80 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-2 ring-1 ring-line">{children}</pre>
    </details>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 w-full overflow-hidden rounded-full bg-line-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular w-9 text-right text-xs text-ink-3">{pct}%</span>
    </div>
  );
}

/* ───────────────────────── form ───────────────────────── */

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputCls =
  "w-full rounded-[7px] bg-surface px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-ink-4 transition-[box-shadow,border-color] focus:ring-2 focus:ring-accent/60 focus:outline-none disabled:bg-sunken disabled:text-ink-3";

export function CandidateId({ id, size = "md" }: { id: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[6px] bg-ink font-mono font-medium tracking-wide text-white shadow-[0_1px_2px_rgb(21_38_59/0.18)]",
        size === "lg" ? "h-8 px-3 text-sm" : "h-6 px-2 text-xs",
      )}
    >
      <EyeOff className={size === "lg" ? "size-3.5" : "size-3"} strokeWidth={1.5} />
      {id}
    </span>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[13px] whitespace-pre-wrap text-deny">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} />
      {error}
    </p>
  );
}
