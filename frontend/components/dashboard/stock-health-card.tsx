import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { displayText, finiteNumber } from "@/lib/display";
import { SectionHeading } from "./section-heading";
import type { StockItem } from "./types";

export function StockHealthCard({ items }: { items: StockItem[] }) {
  return (
    <Card className="panel stock-panel" id="inventory">
      <CardHeader>
        <SectionHeading
          title="Stock health"
          actionLabel="View inventory"
          actionHref="/inventory"
        />
      </CardHeader>
      <CardContent className="stock-table">
        <div className="table-head">
          <span>ITEM</span>
          <span>ON HAND</span>
          <span>STATUS</span>
        </div>
        {items.map((item) => (
          <div className="stock-row" key={item.name}>
            <div>
              <strong>{displayText(item.name, "Item")}</strong>
              <span>{displayText(item.meta, "No stock details")}</span>
            </div>
            <Progress
              className="bar"
              indicatorClassName={item.tone}
              value={finiteNumber(item.value)}
            />
            <Badge
              className={`status ${item.tone}`}
              variant={item.tone === "danger" ? "destructive" : "secondary"}
            >
              {displayText(item.status, "Unknown")}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
