const solutions = [
  {
    title: "Cobros claros",
    text: "Visualiza en segundos quien esta al dia y quien debe."
  },
  {
    title: "Menos seguimiento",
    text: "Reduce atrasos en los pagos sin perseguir a nadie."
  },
  {
    title: "Todo centralizado",
    text: "Centraliza alumnos, cuotas y pagos en un solo lugar."
  },
  {
    title: "Control diario",
    text: "Consulta el estado de tu academia en segundos cada vez que lo necesites."
  }
];

export function SolutionSection({ onPrimaryClick }: { onPrimaryClick: () => void }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.96),rgba(15,15,15,0.98))] px-5 py-8 sm:px-7 sm:py-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Lo que ganas con PaySync</p>
        <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.6rem]">
          Menos seguimiento manual. Mas control real de tus cobros.
        </h2>
        <p className="mt-4 text-base leading-7 text-[#B3B3B3]">
          PaySync te muestra lo importante rapido, para que cobres con orden y tomes decisiones sin depender de planillas ni mensajes sueltos.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {solutions.map((solution, index) => (
          <article key={solution.title} className="rounded-[24px] border border-white/10 bg-[#111111] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#00C896]/12 text-sm font-semibold text-[#00C896]">
                0{index + 1}
              </span>
              <h3 className="text-lg font-semibold text-white">{solution.title}</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#B3B3B3]">{solution.text}</p>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={onPrimaryClick}
          className="inline-flex min-h-12 items-center justify-center rounded-[16px] bg-[#00C896] px-6 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110"
        >
          Empezar ahora
        </button>
      </div>
    </section>
  );
}
