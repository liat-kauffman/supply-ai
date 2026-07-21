import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span>
            <Leaf />
          </span>
          supplai.
        </div>
        <div>
          <p>Human-approved inventory operations</p>
          <h1>
            Less counting.
            <br />
            Better decisions.
          </h1>
          <small>AI proposes. Your team stays in control.</small>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <h2>{title}</h2>
          <p>{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
