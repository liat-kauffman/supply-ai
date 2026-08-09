"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { NavigationItem } from "./types";

interface SidebarProps {
  items: NavigationItem[];
  user: { initials: string; name: string; subtitle: string };
}

export function Sidebar({ items, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentHref = pathname === "/" ? "/" : pathname;

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <Link className="brand" href="/">
        <span className="brand-mark">S</span>
        <span>
          supplai<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {items.map(({ label, href, icon: ItemIcon, badge }) => (
          <Link
            className={href === currentHref ? "active" : undefined}
            href={href}
            key={href}
            aria-current={href === currentHref ? "page" : undefined}
          >
            <ItemIcon />
            {label}
            {badge ? <Badge className="nav-badge">{badge}</Badge> : null}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link href="/profile">
          <Settings />
          Profile & settings
        </Link>
        <div className="profile">
          <Link className="profile-info" href="/profile">
            <Avatar className="avatar">
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <span>
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
