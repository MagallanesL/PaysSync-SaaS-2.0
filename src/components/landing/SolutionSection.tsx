const solutions = [
  {
    title: "Control total",
    text: "Sabe en segundos quien pago y quien debe"
  },
  {
    title: "Registro simple",
    text: "Carga pagos en menos de 10 segundos"
  },
  {
    title: "Resumen mensual",
    text: "Visualiza ingresos y deudas sin esfuerzo"
  },
  {
    title: "Menos tiempo perdido",
    text: "Deja de perseguir pagos manualmente"
  }
];

export function SolutionSection() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.96),rgba(15,15,15,0.98))] px-5 py-8 sm:px-7 sm:py-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">La propuesta</p>
        <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.6rem]">
          Todo eso se termina con PaySync
        </h2>
        <p className="mt-4 text-base leading-7 text-[#B3B3B3]">
          PaySync te muestra lo importante en el momento correcto para que cobres con orden y sin perseguir alumnos manualmente.
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
    </section>
  );
}
