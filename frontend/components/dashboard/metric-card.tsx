import { Card, CardContent } from "@/components/ui/card";
import { displayText } from "@/lib/display";
import Link from "next/link";
import type { Metric } from "./types";

export function MetricCard({ metric }: { metric: Metric }) {
  const {
    icon: MetricIcon,
    tone,
    label,
    value,
    detail,
    href,
    emphasis,
    trend,
  } = metric;
  const safeEmphasis = displayText(emphasis, "");
  return (
    <Card className="metric-card">
      <CardContent>
        <Link className="metric-card-link" href={href}>
          <div className={`metric-icon ${tone}`}>
            <MetricIcon />
          </div>
          <div>
            <span>{displayText(label, "Metric")}</span>
            <strong>{displayText(value)}</strong>
            <small className={trend ? `trend ${trend}` : undefined}>
              {safeEmphasis ? <b>{safeEmphasis}</b> : null}
              {safeEmphasis ? " " : null}
              {displayText(detail, "No details available")}
            </small>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="today-metrics" aria-label="Daily overview">
      {metrics.map((metric) => (
        <MetricCard metric={metric} key={metric.label} />
      ))}
    </section>
  );
}
