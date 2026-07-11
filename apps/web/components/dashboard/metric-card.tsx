import { Card, CardContent } from "@/components/ui/card";
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
  return (
    <Card className="metric-card">
      <CardContent>
        <div className={`metric-icon ${tone}`}>
          <MetricIcon />
        </div>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
          <small className={trend ? `trend ${trend}` : undefined}>
            {emphasis ? <b>{emphasis}</b> : null}
            {emphasis ? " " : null}
            {detail}
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
