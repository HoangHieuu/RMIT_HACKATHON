"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTideCloak } from "@tidecloak/nextjs";
import { useEffect, type ReactNode } from "react";
import {
  FolderKanban,
  FileSignature,
  ScanEye,
  KeyRound,
  ListOrdered,
  Landmark,
  ScrollText,
  LayoutDashboard,
  LogOut,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { ROLE } from "@/lib/veil";
import { cx, Spinner } from "./ui";

// UI gating ONLY. Hidden navigation is not authorization; every API route verifies the token,
// DPoP proof and roles on the server, and identity decryption is decided by the Tide network.
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
      <div className="grid min-h-screen place-items-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-deny">TideCloak failed to initialise</p>
          <p className="mt-1 text-[13px] text-ink-3">{String(initError.message || initError)}</p>
          <p className="mt-3 text-[13px] text-ink-3">Check that TideCloak is running on :8080 and data/tidecloak.json exists.</p>
        </div>
      </div>
    );
  }
  if (isInitializing || !authenticated) {
    return (
      <div className="grid min-h-screen place-items-center text-[13px] text-ink-3">
        <span className="flex items-center gap-2">
          <Spinner className="size-3.5" /> Connecting to TideCloak…
        </span>
      </div>
    );
  }

  const username = String(getValueFromIdToken("preferred_username") ?? "");
  const roles = [ROLE.realmAdmin, ROLE.orgAdmin, ROLE.officer, ROLE.evaluator].filter((r) => has(r));
  const primaryRole = roles[0] ?? (has(ROLE.applicant) ? ROLE.applicant : null);
  const items = NAV.filter((n) => !n.anyRole || n.anyRole.some((r) => has(r)));

  const link = (n: (typeof NAV)[number]) => {
    const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors",
          active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(12_26_46/0.06)] ring-1 ring-line" : "text-ink-2 hover:bg-line-2 hover:text-ink",
        )}
      >
        <n.icon className={cx("size-4", active ? "text-accent" : "text-ink-3")} strokeWidth={1.5} />
        {n.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="border-b border-line bg-canvas lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-[15px] font-semibold tracking-[-0.01em]">VEIL</span>
            </Link>
          </div>
          <div className="mx-3 mb-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-2 ring-1 ring-line">
            <Building2 className="size-3.5 text-ink-3" strokeWidth={1.5} />
            <span className="truncate">Northwind Capital</span>
            <span className="ml-auto rounded bg-sunken px-1 text-[10px] font-medium text-ink-3">SYNTHETIC</span>
          </div>
          <nav className="flex gap-0.5 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
            {items.filter((n) => n.group === "work").map(link)}
            {items.some((n) => n.group === "trust") && <p className="mt-4 mb-1 hidden px-2.5 text-[11px] font-medium text-ink-3 lg:block">Trust</p>}
            {items.filter((n) => n.group === "trust").map(link)}
          </nav>
          <div className="hidden border-t border-line px-3 py-3 lg:block">
            <div className="flex items-center gap-2.5 px-1">
              <span className="grid size-7 place-items-center rounded-full bg-ink text-xs font-semibold text-white uppercase">{username.slice(0, 2)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{username}</p>
                <p className="truncate text-xs text-ink-3">{primaryRole ? ROLE_LABEL[primaryRole] : "No VEIL role"}</p>
              </div>
              <button onClick={() => logout()} title="Sign out" className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink">
                <LogOut className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 bg-surface px-5 py-7 sm:px-8 lg:min-h-screen lg:px-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#0c1a2e" />
      <path d="M6.5 7.5 12 17l5.5-9.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11.25h14" stroke="#5fb0a8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
