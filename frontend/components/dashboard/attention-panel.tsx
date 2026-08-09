import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { displayText } from "@/lib/display";
import { SectionHeading } from "./section-heading";
import type { AttentionTask } from "./types";

export function AttentionPanel({
  tasks,
  onTaskOpen,
}: {
  tasks: AttentionTask[];
  onTaskOpen: (title: string) => void;
}) {
  return (
    <Card className="panel attention">
      <CardHeader>
        <SectionHeading
          title="Needs your attention"
          actionLabel="View receipts"
          actionHref="/receipts"
        />
      </CardHeader>
      <CardContent className="task-list">
        {tasks.length ? (
          tasks.map(({ title, detail, tag, icon: TaskIcon, tone }) => (
            <article className="task" key={title}>
              <div className={`task-icon ${tone}`}>
                <TaskIcon />
              </div>
              <div className="task-copy">
                <strong>{displayText(title, "Task")}</strong>
                <span>{displayText(detail, "No details available")}</span>
              </div>
              <Badge className={`pill ${tone}`} variant="secondary">
                {displayText(tag, "Review")}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Mark ${title} reviewed`}
                onClick={() => onTaskOpen(title)}
              >
                <ChevronRight />
              </Button>
            </article>
          ))
        ) : (
          <article className="task">
            <div className="task-copy">
              <strong>All clear for now</strong>
              <span>No live follow-ups are waiting for review.</span>
            </div>
          </article>
        )}
      </CardContent>
    </Card>
  );
}
