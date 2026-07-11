import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  notificationCount: number;
  onNotificationsClick: () => void;
  onAction: () => void;
}

export function DashboardHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  notificationCount,
  onNotificationsClick,
  onAction,
}: DashboardHeaderProps) {
  return (
    <header>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="header-actions">
        <Button
          className="icon-button"
          size="icon"
          variant="outline"
          aria-label={`${notificationCount} notifications`}
          onClick={onNotificationsClick}
        >
          <Bell />
          {notificationCount > 0 ? <i /> : null}
        </Button>
        <Button className="primary" onClick={onAction}>
          <Plus />
          <span className="action-copy">{actionLabel}</span>
        </Button>
      </div>
    </header>
  );
}
