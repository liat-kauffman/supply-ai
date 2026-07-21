import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayText, finiteNumber } from "@/lib/display";

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
        <p className="eyebrow">{displayText(eyebrow, "TODAY")}</p>
        <h1>{displayText(title, "Today")}</h1>
        <p className="subtitle">{displayText(subtitle, "Daily overview")}</p>
      </div>
      <div className="header-actions">
        <Button
          className="icon-button"
          size="icon"
          variant="outline"
          aria-label={`${finiteNumber(notificationCount)} notifications`}
          onClick={onNotificationsClick}
        >
          <Bell />
          {notificationCount > 0 ? <i /> : null}
        </Button>
        <Button className="primary" onClick={onAction}>
          <Plus />
          <span className="action-copy">
            {displayText(actionLabel, "Add update")}
          </span>
        </Button>
      </div>
    </header>
  );
}
