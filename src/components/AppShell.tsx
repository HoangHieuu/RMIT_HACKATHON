"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTideCloak } from "@/lib/tc";
import { useEffect, type ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  FileSignature,
  FolderKanban,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  RefreshCw,
  ScanEye,
  ScrollText,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { ROLE } from "@/lib/veil";
import { cx, Spinner } from "./ui";

// Navigation only mirrors the roles returned by TideCloak. API routes remain the authority.
const STAFF = [ROLE.orgAdmin, ROLE.officer, ROLE.realmAdmin];
const NAV: { href: string; label: string; icon: LucideIcon; anyRole?: string[]; group: "work" | "trust" }[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, group: "work" },
  { href: "/app/campaigns", label: "Campaigns", icon: FolderKanban, anyRole: STAFF, group: "work" },
  { href: "/app/apply", label: "Apply", icon: FileSignature, anyRole: [ROLE.applicant], group: "work" },
  { href: "/app/review", label: "Blind review", icon: ScanEye, anyRole: [ROLE.evaluator], group: "work" },
  { href: "/app/results", label: "Results", icon: ListOrdered, anyRole: STAFF, group: "work" },
  { href: "/app/disclosure", label: "Disclosure", icon: KeyRound, anyRole: STAFF, group: "trust" },
  { href: "/app/governance", label: "Governance", icon: Landmark, anyRole: STAFF, group: "trust" },
  { href: "/app/audit", label: "Audit log", icon: ScrollText, anyRole: STAFF, group: "trust" },
];

export function useRoles() {
  const { hasRealmRole, hasClientRole } = useTideCloak();
  return (role: string) => (role === ROLE.realmAdmin ? hasClientRole(role, "realm-management") : hasRealmRole(role));
}

const ROLE_LABEL: Record<string, string> = {
  [ROLE.realmAdmin]: "Security admin",
  [ROLE.orgAdmin]: "Organisation admin",
  [ROLE.officer]: "Disclosure officer",
  [ROLE.evaluator]: "Evaluator",
  [ROLE.applicant]: "Applicant",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { authenticated, isInitializing, login, logout, getValueFromIdToken, initError } = useTideCloak();
  const pathname = usePathname();
  const has = useRoles();

  useEffect(() => {
    if (!isInitializing && !authenticated && !initError) login();
  }, [isInitializing, authenticated, initError, login]);

  if (initError) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
        <section className="w-full max-w-[620px] rounded-[24px] bg-surface p-7 shadow-[var(--shadow-window)] ring-1 ring-line sm:p-10">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-base font-semibold tracking-[-0.02em]">VEIL</span>
            <span className="ml-auto rounded-full bg-deny-soft px-3 py-1.5 text-xs font-semibold text-deny">Connection issue</span>
          </div>
          <div className="mt-10 grid size-14 place-items-center rounded-2xl bg-deny-soft text-deny ring-1 ring-deny/10">
            <ShieldAlert className="size-6" strokeWidth={1.7} />
          </div>
          <p className="mt-7 text-[13px] font-semibold tracking-[0.13em] text-ink-3 uppercase">TideCloak connection</p>
          <h1 className="mt-3 text-[clamp(2.25rem,5vw,3rem)] leading-[1.08] font-semibold tracking-[-0.05em] text-ink">The trust service isn&apos;t responding as expected.</h1>
          <p className="mt-4 text-base leading-[1.7] text-ink-3">VEIL needs TideCloak to verify your session and enforce the identity boundary. Check the configured address and DPoP support, then try again.</p>
          <details className="mt-6 rounded-xl bg-canvas p-4 ring-1 ring-line">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">Technical detail</summary>
            <pre className="mt-2 max-h-40 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-ink-3">{String(initError.message || initError)}</pre>
          </details>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button onClick={() => window.location.reload()} className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover">
              <RefreshCw className="size-4" /> Try again
            </button>
            <Link href="/" className="inline-flex h-12 items-center gap-2.5 rounded-lg px-5 text-sm font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-canvas">
              Back to VEIL <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (isInitializing || !authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas text-sm text-ink-3">
        <div className="flex flex-col items-center gap-6">
          <Logo className="size-12" />
          <span className="flex items-center gap-3"><Spinner className="size-5 text-accent" /> Connecting to your protected workspace…</span>
        </div>
      </main>
    );
  }

  const username = String(getValueFromIdToken("preferred_username") ?? "");
  const roles = [ROLE.realmAdmin, ROLE.orgAdmin, ROLE.officer, ROLE.evaluator].filter((r) => has(r));
  const primaryRole = roles[0] ?? (has(ROLE.applicant) ? ROLE.applicant : null);
  const items = NAV.filter((n) => !n.anyRole || n.anyRole.some((r) => has(r)));
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((n) => pathname.startsWith(n.href));

  const link = (n: (typeof NAV)[number]) => {
    const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
          active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink",
        )}
      >
        {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
        <n.icon className={cx("size-[18px] shrink-0", active ? "text-accent" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={1.7} />
        {n.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-canvas lg:pl-[272px]">
      <aside className="border-b border-line bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[272px] lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex min-h-[76px] items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="VEIL home">
            <Logo />
            <span className="text-base font-semibold tracking-[-0.035em]">VEIL</span>
            <span className="ml-0.5 rounded-md bg-sunken px-2 py-1 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Workspace</span>
          </Link>
          <button onClick={() => logout()} title="Sign out" className="grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink lg:hidden">
            <LogOut className="size-[18px]" strokeWidth={1.7} />
          </button>
        </div>

        <div className="mx-3 mb-4 flex min-h-14 items-center gap-3 rounded-xl bg-canvas px-3.5 py-3 ring-1 ring-line/80 lg:mx-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-ink-2 ring-1 ring-line">
            <Building2 className="size-4" strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-2">Northwind Capital</span>
          <span className="rounded bg-white px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-ink-4 ring-1 ring-line/80">DEMO</span>
        </div>

        <nav aria-label="Workspace" className="flex gap-1.5 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3.5">
          <p className="hidden px-3 pb-2 pt-4 text-xs font-semibold tracking-[0.12em] text-ink-4 uppercase lg:block">Evaluate</p>
          {items.filter((n) => n.group === "work").map(link)}
          {items.some((n) => n.group === "trust") && <p className="hidden px-3 pb-2 pt-6 text-xs font-semibold tracking-[0.12em] text-ink-4 uppercase lg:block">Trust controls</p>}
          {items.filter((n) => n.group === "trust").map(link)}
        </nav>

        <div className="hidden border-t border-line-2 px-5 py-5 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white uppercase">{username.slice(0, 2)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{username}</p>
              <p className="truncate text-xs text-ink-3">{primaryRole ? ROLE_LABEL[primaryRole] : "No VEIL role"}</p>
            </div>
            <button onClick={() => logout()} title="Sign out" className="grid size-9 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
              <LogOut className="size-[18px]" strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:px-7 lg:px-10">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.13em] text-ink-4 uppercase">VEIL <span className="px-1 text-mark">/</span> Workspace</p>
            <p className="mt-1 text-sm font-medium text-ink-2">{current?.label ?? "Evaluation"}</p>
          </div>
          <div className="flex items-center gap-2.5 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-ink-2 ring-1 ring-line">
            <span className="size-1.5 rounded-full bg-seal" /> Protected session
          </div>
        </header>
        <main className="min-w-0 px-4 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-7 shrink-0", className)} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#15263b" />
      <path d="M8.5 10.5 15.9 23l7.6-12.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 16h17" stroke="#70c5b7" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 16v7" stroke="#70c5b7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
