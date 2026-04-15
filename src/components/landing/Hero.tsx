import summaryPreview from "../../asset/resumen.png";

export function Hero({
  trialDays,
  onPrimaryClick,
  onSecondaryClick
}: {
  trialDays: number;
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(26,26,26,0.96),rgba(11,11,11,0.98))] px-5 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,200,150,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_24%)]" />
      <div className="relative grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-[#00C896]/20 bg-[#00C896]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00C896]">
            Cobros ordenados para academias
          </div>
          <h1 className="mt-5 max-w-3xl text-[2.35rem] font-semibold leading-[1.02] text-white sm:text-5xl lg:text-[4.2rem]">
            Deja de perseguir alumnos para cobrar. Automatiza tus cuotas con PaySync.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#B3B3B3] sm:text-lg sm:leading-8">
            Organiza pagos, reduce morosidad y controla tu academia desde un solo lugar.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] bg-[#00C896] px-6 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110"
            >
              Probar gratis
            </button>
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition hover:border-[#00C896] hover:text-[#00C896]"
            >
              Crear cuenta en 1 minuto
            </button>
          </div>

          <button
            type="button"
            onClick={onSecondaryClick}
            className="mt-3 inline-flex text-sm font-medium text-[#B3B3B3] transition hover:text-white"
          >
            Ver como funciona
          </button>

          <p className="mt-3 text-sm text-[#B3B3B3]">Prueba gratis por {trialDays} dias. Crea tu cuenta en menos de 1 minuto.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Cobros claros" value="Quien pago y quien no" />
            <Metric label="Menos demora" value="Menos mora, mas orden" />
            <Metric label="Gestion simple" value="Tu academia en un panel" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[32px] bg-[#00C896]/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#121212] p-3 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
            <div className="rounded-[22px] border border-white/10 bg-[#141414] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#00C896]">Dashboard</p>
                  <p className="mt-1 text-sm text-[#B3B3B3]">Pagos, cuotas y alumnos en un solo lugar</p>
                </div>
                <span className="rounded-full bg-[#00C896]/12 px-3 py-1 text-xs font-semibold text-[#00C896]">Al dia</span>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-[24px] border border-white/10 bg-[#0E0E0E]">
              <img src={summaryPreview} alt="Vista general del panel de PaySync." className="h-full w-full object-cover" />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MockPill label="Pagaron" value="91" accent="text-[#00C896]" />
              <MockPill label="Pendientes" value="23" accent="text-white" />
              <MockPill label="Vencen hoy" value="12" accent="text-[#B3B3B3]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#B3B3B3]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function MockPill({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-[#111111] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#B3B3B3]">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
