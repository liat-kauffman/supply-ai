"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { NavigationItem } from "./types";

interface SidebarProps {
  items: NavigationItem[];
  user: { initials: string; name: string; subtitle: string };
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ items, user, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const currentHref = pathname === "/" ? "/" : pathname;

  useEffect(() => {
    const saved = window.localStorage.getItem("supplai.sidebar.collapsed");
    if (saved === "true") {
      setCollapsed(true);
      onCollapsedChange?.(true);
    }
  }, [onCollapsedChange]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("supplai.sidebar.collapsed", String(next));
      onCollapsedChange?.(next);
      return next;
    });
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-brand-row">
        <Link className="brand" href="/">
          <span className="brand-mark">S</span>
          <span className="brand-wordmark">
            supplai<span className="brand-dot">.</span>
          </span>
        </Link>
        <Button
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="sidebar-toggle"
          onClick={toggleCollapsed}
          size="icon"
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
      <nav aria-label="Main navigation">
        {items.map(({ label, href, icon: ItemIcon, badge }) => (
          <Link
            className={href === currentHref ? "active" : undefined}
            href={href}
            key={href}
            aria-current={href === currentHref ? "page" : undefined}
            aria-label={label}
            title={collapsed ? label : undefined}
          >
            <ItemIcon />
            <span className="sidebar-label">{label}</span>
            {badge ? <Badge className="nav-badge">{badge}</Badge> : null}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link
          href="/profile"
          aria-label="Profile and settings"
          title={collapsed ? "Profile and settings" : undefined}
        >
          <Settings />
          <span className="sidebar-label">Profile & settings</span>
        </Link>
        <div className="profile">
          <Link className="profile-info" href="/profile">
            <Avatar className="avatar">
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <span className="profile-copy">
              <strong>{user.name}</strong>
              <small>{user.subtitle}</small>
            </span>
          </Link>
          <Button
            aria-label="Sign out"
            onClick={signOut}
            size="icon"
            variant="ghost"
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </aside>
  );
}
