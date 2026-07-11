import { MoreHorizontal, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NavigationItem } from "./types";

interface SidebarProps {
  items: NavigationItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
  user: { initials: string; name: string; subtitle: string };
}

export function Sidebar({ items, activeHref, onNavigate, user }: SidebarProps) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#">
        <span className="brand-mark">S</span>
        <span>
          supplying<span className="brand-dot">.</span>
        </span>
      </a>
      <nav aria-label="Main navigation">
        {items.map(({ label, href, icon: ItemIcon, badge }) => (
          <a
            className={href === activeHref ? "active" : undefined}
            href={href}
            key={href}
            onClick={() => onNavigate(href)}
          >
            <ItemIcon />
            {label}
            {badge ? <Badge className="nav-badge">{badge}</Badge> : null}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <a href="#settings">
          <Settings />
          Settings
        </a>
        <div className="profile">
          <Avatar className="avatar">
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
          <span>
            <strong>{user.name}</strong>
            <small>{user.subtitle}</small>
          </span>
          <Button aria-label="Profile menu" size="icon" variant="ghost">
            <MoreHorizontal />
          </Button>
        </div>
      </div>
    </aside>
  );
}
