export function Pricing({
  trialDays,
  monthlyPrice,
  onPrimaryClick
}: {
  trialDays: number;
  monthlyPrice: number;
  onPrimaryClick: () => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.96),rgba(11,11,11,0.98))] px-5 py-8 sm:px-7 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Precio</p>
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.6rem]">
            Simple y sin vueltas
          </h2>
          <p className="mt-4 text-base leading-7 text-[#B3B3B3]">
            Empiezas con prueba gratis y luego continuas con un abono mensual claro para seguir cobrando con orden.
          </p>
        </div>

        <div className="rounded-[28px] border border-[#00C896]/20 bg-[#101010] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#00C896]">Plan inicial</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-semibold text-white">${monthlyPrice}</span>
            <span className="pb-1 text-sm text-[#B3B3B3]">/ mes</span>
          </div>
          <div className="mt-6 grid gap-3">
            <PriceItem text={`${trialDays} dias gratis`} />
            <PriceItem text="Luego mensual" />
            <PriceItem text="Sin implementacion larga" />
          </div>
          <button
            type="button"
            onClick={onPrimaryClick}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[16px] bg-[#00C896] px-6 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110"
          >
            Empezar ahora
          </button>
        </div>
      </div>
    </section>
  );
}

function PriceItem({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white">
      {text}
    </div>
  );
}
