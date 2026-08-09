import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { displayPercent, displayText, finiteNumberOrNull } from "@/lib/display";

interface InsightCardProps {
  title: string;
  description: string;
  confidence: number;
  dataDays: number | null;
  source: "ai" | "fallback";
}

export function InsightCard({
  title,
  description,
  confidence,
  dataDays,
  source,
}: InsightCardProps) {
  return (
    <Card className="panel insight">
      <CardContent>
        <div className="sparkle">
          <Sparkles />
        </div>
        <div>
          <span className="ai-label">
            {source === "ai" ? "SUPPLAI AI INSIGHT" : "SUPPLAI INSIGHT"}
          </span>
          <h3>{displayText(title, "No insight available yet")}</h3>
          <p>{displayText(description, "More inventory data is needed.")}</p>
          <div className="evidence">
            <Badge variant="outline">
              {source === "ai" ? "AI confidence" : "Data confidence"}{" "}
              <strong>{displayPercent(confidence)}</strong>
            </Badge>
            <Badge variant="outline">
              {finiteNumberOrNull(dataDays) === null ? (
                <>
                  Uses <strong>live records</strong>
                </>
              ) : (
                <>
                  Uses <strong>{finiteNumberOrNull(dataDays)} days</strong> of
                  data
                </>
              )}
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
