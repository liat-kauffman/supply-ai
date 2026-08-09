"use client";

import {
  BarChart3,
  Camera,
  CircleDollarSign,
  PackageOpen,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/stores/dashboard-store";
import { navigation } from "./dashboard-data";
import { AttentionPanel } from "./attention-panel";
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
  const acknowledgedTasks = useDashboardStore(
    (state) => state.acknowledgedTasks,
  );
  const message = useDashboardStore((state) => state.message);
  const acknowledgeTask = useDashboardStore((state) => state.acknowledgeTask);
  const showMessage = useDashboardStore((state) => state.showMessage);
  const clearMessage = useDashboardStore((state) => state.clearMessage);
  const [notificationCount, setNotificationCount] = useState(
    dashboard.tasks.length,
  );

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

  const tasks = dashboard.tasks.map((task) => ({
    ...task,
    icon:
      task.icon === "receipt"
        ? ReceiptText
        : task.icon === "camera"
          ? Camera
          : PackageOpen,
  }));

  const visibleTasks = tasks.filter(
    (task) => !acknowledgedTasks.includes(task.title),
  );
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const firstName = userName.split(/\s+/)[0] || userName;

  return (
    <div className="app-shell">
      <Sidebar
        items={navigation}
        user={{
          initials,
          name: userName,
          subtitle: companyName,
        }}
      />
      <main>
        <DashboardHeader
          eyebrow={dashboard.headerEyebrow}
          title={`Good morning, ${firstName}.`}
          subtitle="Here’s what needs your attention today."
          actionLabel="Add stock update"
          notificationCount={notificationCount}
          onNotificationsClick={() => setNotificationCount(0)}
          onAction={() =>
            showMessage("Stock update workflow is ready to open.")
          }
        />
        {message ? (
          <div className="store-message" role="status">
            <CheckCircle2 />
            <span>{message}</span>
            <Button
              aria-label="Dismiss message"
              size="icon"
              variant="ghost"
              onClick={clearMessage}
            >
              <X />
            </Button>
          </div>
        ) : null}
        <MetricsGrid metrics={metrics} />
        <div className="dashboard-grid">
          <AttentionPanel tasks={visibleTasks} onTaskOpen={acknowledgeTask} />
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
