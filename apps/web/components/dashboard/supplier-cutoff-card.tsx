import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionHeading } from "./section-heading";
import type { SupplierCutoffData } from "./types";

interface SupplierCutoffCardProps {
  supplier: SupplierCutoffData;
  nextSupplier: {
    name: string;
    logo: string;
    schedule: string;
    relativeTime: string;
  };
}

export function SupplierCutoffCard({
  supplier,
  nextSupplier,
}: SupplierCutoffCardProps) {
  const progress = Math.round(
    (supplier.basketValue / supplier.minimumValue) * 100,
  );
  return (
    <Card className="panel cutoff" id="orders">
      <CardHeader>
        <SectionHeading
          title="Today’s supplier cutoffs"
          description="Orders to confirm before the deadline."
        />
      </CardHeader>
      <CardContent>
        <div className="cutoff-row">
          <div className="supplier-logo dairy">{supplier.logo}</div>
          <div>
            <strong>{supplier.name}</strong>
            <span>{supplier.deliveryLabel}</span>
          </div>
          <div className="cutoff-time">
            <small>Cutoff in</small>
            <strong>{supplier.cutoffLabel}</strong>
          </div>
        </div>
        <div className="order-progress">
          <div>
            <span>Basket estimate</span>
            <strong>
              {supplier.currency}
              {supplier.basketValue} / {supplier.currency}
              {supplier.minimumValue} minimum
            </strong>
          </div>
          <Progress value={progress} />
          <small>{supplier.remainingMessage}</small>
        </div>
        <Button className="secondary" variant="secondary">
          Review basket <ArrowRight />
        </Button>
        <div className="next-cutoff">
          <div className="supplier-logo bakery">{nextSupplier.logo}</div>
          <div>
            <strong>{nextSupplier.name}</strong>
            <span>{nextSupplier.schedule}</span>
          </div>
          <span>{nextSupplier.relativeTime}</span>
        </div>
      </CardContent>
    </Card>
  );
}
