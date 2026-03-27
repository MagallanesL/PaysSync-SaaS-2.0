import type { ReactNode } from "react";

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-brand border border-slate-700/80 bg-surface p-4 shadow-soft">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg text-text">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
