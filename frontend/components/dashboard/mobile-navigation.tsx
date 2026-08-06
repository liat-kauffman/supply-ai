"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function MobileNavigation({
  items,
}: {
  items: Array<{ label: string; href: string; icon: LucideIcon }>;
}) {
  const pathname = usePathname();
  const mobileItems = items.filter((item) =>
    [
      "/",
      "/inventory",
      "/orders",
      "/receipts",
      "/analytics",
      "/company/workers",
    ].includes(item.href),
  );

  return (
    <nav className="mobile-nav">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            className={item.href === pathname ? "active" : undefined}
            href={item.href}
            key={item.href}
            aria-current={item.href === pathname ? "page" : undefined}
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
