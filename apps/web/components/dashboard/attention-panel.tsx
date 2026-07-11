import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
          description="AI suggestions always wait for your approval."
          actionLabel="View all"
          actionHref="#activity"
        />
      </CardHeader>
      <CardContent className="task-list">
        {tasks.map(({ title, detail, tag, icon: TaskIcon, tone }) => (
          <article className="task" key={title}>
            <div className={`task-icon ${tone}`}>
              <TaskIcon />
            </div>
            <div className="task-copy">
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            <Badge className={`pill ${tone}`} variant="secondary">
              {tag}
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
        ))}
      </CardContent>
    </Card>
  );
}
