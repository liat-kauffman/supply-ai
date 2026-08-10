import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { displayText } from "@/lib/display";

interface DashboardHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref: string;
}

export function DashboardHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionHref,
}: DashboardHeaderProps) {
  return (
    <header className="today-header">
      <div>
        <p className="eyebrow">{displayText(eyebrow, "TODAY")}</p>
        <h1>{displayText(title, "Today")}</h1>
        <p className="subtitle">{displayText(subtitle, "Daily overview")}</p>
      </div>
      <div className="header-actions">
        <Button asChild className="primary">
          <Link href={actionHref}>
            <Plus />
            <span className="action-copy">
              {displayText(actionLabel, "Add update")}
            </span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
