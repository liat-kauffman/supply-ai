import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InsightCardProps {
  title: string;
  description: string;
  confidence: number;
  dataDays: number;
}

export function InsightCard({
  title,
  description,
  confidence,
  dataDays,
}: InsightCardProps) {
  return (
    <Card className="panel insight">
      <CardContent>
        <div className="sparkle">
          <Sparkles />
        </div>
        <div>
          <span className="ai-label">SUPPLYING INSIGHT</span>
          <h3>{title}</h3>
          <p>{description}</p>
          <div className="evidence">
            <Badge variant="outline">
              Confidence <strong>{confidence}%</strong>
            </Badge>
            <Badge variant="outline">
              Uses <strong>{dataDays} days</strong> of data
            </Badge>
          </div>
          <Button variant="link">
            View recommendation <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
