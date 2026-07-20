import { Card, CardContent } from "@/components/ui/card";
import { displayText } from "@/lib/display";
import type { Metric } from "./types";

export function MetricCard({ metric }: { metric: Metric }) {
  const {
    icon: MetricIcon,
    tone,
    label,
    value,
    detail,
    emphasis,
    trend,
  } = metric;
  const safeEmphasis = displayText(emphasis, "");
  return (
    <Card className="metric-card">
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="metrics" aria-label="Daily overview">
      {metrics.map((metric) => (
        <MetricCard metric={metric} key={metric.label} />
      ))}
    </section>
  );
}
