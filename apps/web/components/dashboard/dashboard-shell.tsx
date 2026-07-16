"use client";

import { CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/stores/dashboard-store";
import { metrics, navigation, stock, supplier, tasks } from "./dashboard-data";
import { AttentionPanel } from "./attention-panel";
import { DashboardHeader } from "./dashboard-header";
import { InsightCard } from "./insight-card";
import { MetricsGrid } from "./metric-card";
import { MobileNavigation } from "./mobile-navigation";
import { Sidebar } from "./sidebar";
import { StockHealthCard } from "./stock-health-card";
import { SupplierCutoffCard } from "./supplier-cutoff-card";
export function DashboardShell() {
  const activeHref = useDashboardStore((state) => state.activeHref);
  const acknowledgedTasks = useDashboardStore(
    (state) => state.acknowledgedTasks,
  );
  const notificationCount = useDashboardStore(
    (state) => state.notificationCount,
  );
  const message = useDashboardStore((state) => state.message);
  const navigate = useDashboardStore((state) => state.navigate);
  const acknowledgeTask = useDashboardStore((state) => state.acknowledgeTask);
  const clearNotifications = useDashboardStore(
    (state) => state.clearNotifications,
  );
  const showMessage = useDashboardStore((state) => state.showMessage);
  const clearMessage = useDashboardStore((state) => state.clearMessage);

  const visibleTasks = tasks.filter(
    (task) => !acknowledgedTasks.includes(task.title),
  );

  return (
    <div className="app-shell">
      <Sidebar
        items={navigation}
        activeHref={activeHref}
        onNavigate={navigate}
        user={{
          initials: "MK",
          name: "Maya Klein",
          subtitle: "Manager · Supply Café",
        }}
      />
      <main>
        <DashboardHeader
          eyebrow="SATURDAY, JULY 11"
          title="Good morning, Maya."
          subtitle="Here’s what needs your attention today."
          actionLabel="Add stock update"
          notificationCount={notificationCount}
          onNotificationsClick={clearNotifications}
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
            supplier={supplier}
            nextSupplier={{
              name: "Central Bakery",
              logo: "B",
              schedule: "Monday · 10:00 cutoff",
              relativeTime: "In 2 days",
            }}
          />
          <StockHealthCard items={stock} />
          <InsightCard
            title="You may run short on oat milk before Monday."
            description="Based on the last 14 days, weekend usage is 22% higher. Adding 6 cartons to today’s Dairy Direct order should cover expected demand plus safety stock."
            confidence={91}
            dataDays={14}
          />
        </div>
        <footer>
          Inventory changes are never made without your approval.{" "}
          <a href="#activity">View audit history</a>
        </footer>
      </main>
      <MobileNavigation
        items={navigation.map(({ label, href }) => ({ label, href }))}
        activeHref={activeHref}
        onNavigate={navigate}
      />
    </div>
  );
}
