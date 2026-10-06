"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "../providers/account";
import { BellIcon, SearchIcon, StoreIcon } from "../ui/icons";
import { cx } from "../ui/primitives";

export const NAV = [
  { href: "/", label: "Search", Icon: SearchIcon },
  { href: "/pharmacies", label: "Pharmacies", Icon: StoreIcon },
  { href: "/notifications", label: "Notifications", Icon: BellIcon },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span aria-label={`${count} unread`} className="absolute -right-3 -top-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Top navigation (tablet and up). */
export function TopNav() {
  const pathname = usePathname();
  const { unread } = useAccount();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cx("relative inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-ink")}>
            <span className="relative">
              <Icon size={18} />
              {href === "/notifications" && <UnreadBadge count={unread} />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar (phones): the three places, within thumb reach. */
export function BottomNav() {
  const pathname = usePathname();
  const { unread } = useAccount();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-brand" : "text-muted")}>
                <span className="relative">
                  <Icon size={22} />
                  {href === "/notifications" && <UnreadBadge count={unread} />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
