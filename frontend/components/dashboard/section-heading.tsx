import { ArrowRight } from "lucide-react";

interface SectionHeadingProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function SectionHeading({
  title,
  description,
  actionLabel,
  actionHref = "#",
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel ? (
        <a href={actionHref}>
          {actionLabel} <ArrowRight />
        </a>
      ) : null}
    </div>
  );
}
