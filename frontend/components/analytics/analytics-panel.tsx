import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Package,
  ReceiptText,
  Store,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayMoney, displayNumber } from "@/lib/display";
import type { AnalyticsData, AnalyticsPeriod } from "@/lib/analytics";

function PeriodDetail({
  label,
  period,
  currency,
}: {
  label: string;
  period: AnalyticsPeriod;
  currency: string;
}) {
  return (
    <Card className="analytics-period-card">
      <CardHeader>
        <p className="analytics-kicker">{label}</p>
        <CardTitle>{displayMoney(period.spend, currency)}</CardTitle>
        <p className="analytics-muted">Total recorded spend</p>
      </CardHeader>
      <CardContent className="analytics-fact-grid">
        <div>
          <ReceiptText />
          <span>
            Receipts<strong>{period.receiptCount}</strong>
          </span>
        </div>
        <div>
          <CheckCircle2 />
          <span>
            Approved<strong>{period.approvedCount}</strong>
          </span>
        </div>
        <div>
          <ClipboardList />
          <span>
            Pending<strong>{period.pendingCount}</strong>
          </span>
        </div>
        <div>
          <Package />
          <span>
            Line items<strong>{period.lineCount}</strong>
          </span>
        </div>
        <div>
          <TrendingUp />
          <span>
            Average receipt
            <strong>{displayMoney(period.averageReceipt, currency)}</strong>
          </span>
        </div>
        <div>
          <Store />
          <span>
            Top supplier<strong>{period.topSupplier}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel({ analytics }: { analytics: AnalyticsData }) {
  const maxSpend = Math.max(
    ...analytics.monthlyTrend.map((month) => month.spend),
    1,
  );

  return (
    <div className="analytics-content">
      <section
        className="analytics-period-grid"
        aria-label="Period performance"
      >
        <PeriodDetail
          label={analytics.monthLabel}
          period={analytics.month}
          currency={analytics.currency}
        />
        <PeriodDetail
          label={analytics.yearLabel}
          period={analytics.year}
          currency={analytics.currency}
        />
      </section>

      <section className="analytics-grid" aria-label="Business analytics">
        <Card>
          <CardHeader>
            <CardTitle>Spend trend</CardTitle>
            <p className="analytics-muted">
              Receipt spend across the last six months
            </p>
          </CardHeader>
          <CardContent className="analytics-chart">
            {analytics.monthlyTrend.map((month) => (
              <div className="analytics-bar-column" key={month.label}>
                <span>{displayMoney(month.spend, analytics.currency)}</span>
                <div className="analytics-bar-track">
                  <i
                    style={{
                      height: `${Math.max((month.spend / maxSpend) * 100, month.spend ? 8 : 2)}%`,
                    }}
                  />
                </div>
                <strong>{month.label}</strong>
                <small>{month.receiptCount} receipts</small>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier spend</CardTitle>
            <p className="analytics-muted">
              Highest recorded spend in the selected period
            </p>
          </CardHeader>
          <CardContent className="analytics-list">
            {analytics.supplierSpend.length ? (
              analytics.supplierSpend.map((supplier) => (
                <div className="analytics-list-row" key={supplier.name}>
                  <span>
                    <strong>{supplier.name}</strong>
                    <small>{supplier.receiptCount} receipts</small>
                  </span>
                  <strong>
                    {displayMoney(supplier.spend, analytics.currency)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="analytics-empty">No supplier spend recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders overview</CardTitle>
            <p className="analytics-muted">
              Planning and approval activity this year
            </p>
          </CardHeader>
          <CardContent className="analytics-overview-grid">
            <div>
              <BarChart3 />
              <span>
                This month<strong>{analytics.orders.monthCount}</strong>
              </span>
            </div>
            <div>
              <ClipboardList />
              <span>
                This year<strong>{analytics.orders.yearCount}</strong>
              </span>
            </div>
            <div>
              <CheckCircle2 />
              <span>
                Approved<strong>{analytics.orders.approvedCount}</strong>
              </span>
            </div>
            <div>
              <TrendingUp />
              <span>
                Estimated value
                <strong>
                  {displayMoney(
                    analytics.orders.estimatedSpend,
                    analytics.currency,
                  )}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operating footprint</CardTitle>
            <p className="analytics-muted">Current workspace coverage</p>
          </CardHeader>
          <CardContent className="analytics-overview-grid">
            <div>
              <Package />
              <span>
                Active products
                <strong>
                  {displayNumber(analytics.inventory.activeProducts)}
                </strong>
              </span>
            </div>
            <div>
              <Store />
              <span>
                Active suppliers
                <strong>
                  {displayNumber(analytics.inventory.activeSuppliers)}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
