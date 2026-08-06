"use client";

import type { ReactNode } from "react";

import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { navigation } from "@/components/dashboard/dashboard-data";
import { Sidebar } from "@/components/dashboard/sidebar";

function initialsFor(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export function AccountShell({
  title,
  subtitle,
  companyName,
  userName,
  children,
}: {
  title: string;
  subtitle: string;
  companyName: string;
  userName: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar
        items={navigation}
        user={{
          initials: initialsFor(userName),
          name: userName,
          subtitle: companyName,
        }}
      />
      <main className="account-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">ACCOUNT</p>
            <h1>{title}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
        </header>
        {children}
      </main>
      <MobileNavigation
        items={navigation.map(({ label, href, icon }) => ({
          label,
          href,
          icon,
        }))}
      />
    </div>
  );
}
