import { ArrowRight } from "lucide-react";
import Link from "next/link";

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
        <Link href={actionHref}>
          {actionLabel} <ArrowRight />
        </Link>
      ) : null}
    </div>
  );
}
