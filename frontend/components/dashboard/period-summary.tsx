import { CalendarDays, CheckCircle2, ReceiptText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayMoney } from "@/lib/display";
import type { PeriodSummaryData } from "@/lib/dashboard";

function PeriodCard({
  label,
  summary,
}: {
  label: string;
  summary: PeriodSummaryData;
}) {
  return (
    <Card className="period-card">
      <CardHeader>
        <div className="period-card-heading">
          <span className="period-icon">
            <CalendarDays />
          </span>
          <div>
            <CardTitle>{label}</CardTitle>
            <p>Spend and approved activity</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <strong className="period-total">
          {displayMoney(summary.spend, summary.currency)}
        </strong>
        <div className="period-facts">
          <span>
            <ReceiptText /> {summary.receiptCount} receipts
          </span>
          <span>
            <CheckCircle2 /> {summary.approvedCount} approved
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function PeriodSummary({
  month,
  year,
}: {
  month: PeriodSummaryData;
  year: PeriodSummaryData;
}) {
  return (
    <section className="period-summary" aria-label="Period summary">
      <PeriodCard label="This month" summary={month} />
      <PeriodCard label="This year" summary={year} />
    </section>
  );
}
