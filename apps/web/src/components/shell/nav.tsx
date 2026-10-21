"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "../providers/account";
import { BellIcon, SearchIcon, StoreIcon } from "../ui/icons";
import { cx } from "../ui/primitives";

export const NAV = [
  { href: "/search", label: "Search", Icon: SearchIcon },
  { href: "/pharmacies", label: "Pharmacies", Icon: StoreIcon },
  { href: "/notifications", label: "Notifications", Icon: BellIcon },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cx("ui-mono relative inline-flex h-10 items-center gap-2 px-3 text-[0.75rem] font-medium uppercase tracking-[0.06em] underline-offset-[0.55em] transition-colors", active ? "text-ink underline decoration-2 decoration-brand" : "text-muted hover:text-ink hover:underline")}>
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
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-canvas safe-area-bottom md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("ui-mono -mt-px flex h-16 flex-col items-center justify-center gap-1 border-t-2 text-[0.65rem] font-medium uppercase tracking-[0.06em]", active ? "border-brand text-brand" : "border-transparent text-muted")}>
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
