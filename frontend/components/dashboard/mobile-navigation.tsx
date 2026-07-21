import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function MobileNavigation({
  items,
  activeHref,
  onNavigate,
}: {
  items: Array<{ label: string; href: string; icon: LucideIcon }>;
  activeHref: string;
  onNavigate: (href: string) => void;
}) {
  const mobileItems = items.filter((item) =>
    ["/", "/inventory", "/orders", "/receipts"].includes(item.href),
  );

  return (
    <nav className="mobile-nav">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            className={item.href === activeHref ? "active" : undefined}
            href={item.href}
            key={item.href}
            onClick={() => onNavigate(item.href)}
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
