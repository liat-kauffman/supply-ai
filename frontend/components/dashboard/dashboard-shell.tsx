"use client";

import {
  BarChart3,
  CircleDollarSign,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { navigation } from "./dashboard-data";
import { DashboardHeader } from "./dashboard-header";
import { InsightCard } from "./insight-card";
import { MetricsGrid } from "./metric-card";
import { MobileNavigation } from "./mobile-navigation";
import { Sidebar } from "./sidebar";
import { StockHealthCard } from "./stock-health-card";
import { SupplierCutoffCard } from "./supplier-cutoff-card";
import type { DashboardData } from "@/lib/dashboard";
export function DashboardShell({
  companyName,
  userName,
  dashboard,
}: {
  companyName: string;
  userName: string;
  dashboard: DashboardData;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const metrics = dashboard.metrics.map((metric) => ({
    ...metric,
    icon:
      metric.icon === "receipt"
        ? ReceiptText
        : metric.icon === "alert"
          ? TriangleAlert
          : metric.icon === "money"
            ? CircleDollarSign
            : BarChart3,
  }));

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const firstName = userName.split(/\s+/)[0] || userName;

  return (
    <div
      className={`app-shell today-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      <Sidebar
        items={navigation}
        onCollapsedChange={setSidebarCollapsed}
        user={{
          initials,
          name: userName,
          subtitle: companyName,
        }}
      />
      <main className="today-main">
        <DashboardHeader
          eyebrow={dashboard.headerEyebrow}
          title={`Good morning, ${firstName}.`}
          subtitle="Here’s what needs your attention today."
          actionLabel="Update inventory"
          actionHref="/inventory"
        />
        <MetricsGrid metrics={metrics} />
        <div className="today-grid">
          <SupplierCutoffCard
            supplier={dashboard.supplier}
            nextSupplier={dashboard.nextSupplier}
          />
          <StockHealthCard items={dashboard.stock} />
          <InsightCard
            title={dashboard.insight.title}
            description={dashboard.insight.description}
            confidence={dashboard.insight.confidence}
            dataDays={dashboard.insight.dataDays}
            source={dashboard.insight.source}
          />
        </div>
        <footer>Inventory changes are never made without your approval.</footer>
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
