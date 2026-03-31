import type { ReactNode } from "react";

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-brand border border-[rgba(0,209,255,0.15)] bg-[#121A2B] p-5 shadow-soft">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg text-[#F5F7FB]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
