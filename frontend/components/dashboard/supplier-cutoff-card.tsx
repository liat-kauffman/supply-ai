import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { displayMoney, displayText, finiteNumber } from "@/lib/display";
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
  const progress =
    finiteNumber(supplier.minimumValue) > 0
      ? Math.round(
          (finiteNumber(supplier.basketValue) /
            finiteNumber(supplier.minimumValue)) *
            100,
        )
      : 0;
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
          <div className="supplier-logo dairy">
            {displayText(supplier.logo, "S")}
          </div>
          <div>
            <strong>{displayText(supplier.name, "Supplier")}</strong>
            <span>
              {displayText(supplier.deliveryLabel, "Delivery pending")}
            </span>
          </div>
          <div className="cutoff-time">
            <small>Cutoff in</small>
            <strong>
              {displayText(supplier.cutoffLabel, "Not scheduled")}
            </strong>
          </div>
        </div>
        <div className="order-progress">
          <div>
            <span>Basket estimate</span>
            <strong>
              {displayMoney(supplier.basketValue, supplier.currency)} /{" "}
              {displayMoney(supplier.minimumValue, supplier.currency)} minimum
            </strong>
          </div>
          <Progress value={progress} />
          <small>
            {displayText(supplier.remainingMessage, "No target set")}
          </small>
        </div>
        <Button asChild className="secondary" variant="secondary">
          <Link href="/orders">
            Review basket <ArrowRight />
          </Link>
        </Button>
        <div className="next-cutoff">
          <div className="supplier-logo bakery">
            {displayText(nextSupplier.logo, "S")}
          </div>
          <div>
            <strong>{displayText(nextSupplier.name, "Supplier")}</strong>
            <span>{displayText(nextSupplier.schedule, "Not scheduled")}</span>
          </div>
          <span>{displayText(nextSupplier.relativeTime, "Pending")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
