const testimonials = [
  {
    quote: "Antes cobraba mirando transferencias y chats. Ahora veo en un minuto quien esta al dia.",
    name: "Carla M.",
    role: "Academia de danza"
  },
  {
    quote: "Lo que mas valoro es dejar de perseguir pagos a mano. Me ordeno todo el mes.",
    name: "Nicolas R.",
    role: "Escuela de futbol"
  },
  {
    quote: "Pasamos de tener notas sueltas a ver alumnos, pagos y deudas en un solo panel.",
    name: "Sofia L.",
    role: "Centro de entrenamiento"
  }
];

export function Testimonials({ onPrimaryClick }: { onPrimaryClick: () => void }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[#121212] px-5 py-8 sm:px-7 sm:py-10">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Confianza</p>
        <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.6rem]">
          Pensado para academias, entrenadores y clubes que necesitan ordenar sus cobros sin complicarse.
        </h2>
        <p className="mt-4 text-base leading-7 text-[#B3B3B3]">
          Esta seccion ya queda lista para seguir sumando testimonios y prueba social a medida que avances.
        </p>
      </div>

      <div className="mt-8 rounded-[24px] border border-[#00C896]/20 bg-[#101010] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-white">Preparado para generar confianza desde el primer vistazo</p>
            <p className="mt-2 text-sm leading-7 text-[#B3B3B3]">
              Puedes seguir alimentando este bloque con casos reales, resultados y testimonios sin tocar la estructura visual actual.
            </p>
          </div>
          <button
            type="button"
            onClick={onPrimaryClick}
            className="inline-flex min-h-12 items-center justify-center rounded-[16px] bg-[#00C896] px-6 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110"
          >
            Crear cuenta
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {testimonials.map((item) => (
          <article key={item.name} className="rounded-[24px] border border-white/10 bg-[#101010] p-5 sm:p-6">
            <p className="text-sm leading-7 text-white">"{item.quote}"</p>
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-sm font-semibold text-white">{item.name}</p>
              <p className="mt-1 text-sm text-[#B3B3B3]">{item.role}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
