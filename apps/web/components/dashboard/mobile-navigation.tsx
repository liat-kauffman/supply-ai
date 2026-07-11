import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNavigation({
  items,
  activeHref,
  onNavigate,
}: {
  items: Array<{ label: string; href: string }>;
  activeHref: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className="mobile-nav">
      {items.slice(0, 2).map((item) => (
        <a
          className={item.href === activeHref ? "active" : undefined}
          href={item.href}
          key={item.href}
          onClick={() => onNavigate(item.href)}
        >
          {item.label}
        </a>
      ))}
      <Button size="icon" aria-label="Add stock update">
        <Plus />
      </Button>
      {items.slice(2, 4).map((item) => (
        <a
          className={item.href === activeHref ? "active" : undefined}
          href={item.href}
          key={item.href}
          onClick={() => onNavigate(item.href)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
