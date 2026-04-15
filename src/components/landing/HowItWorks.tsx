import createFeePreview from "../../asset/crear cuota.png";
import feesPreview from "../../asset/cuotas.png";

const steps = [
  "Creas tus disciplinas y cuotas",
  "Asignas alumnos automaticamente",
  "Registras y controlas pagos facilmente"
];

export function HowItWorks({ onPrimaryClick }: { onPrimaryClick: () => void }) {
  return (
    <section id="como-funciona" className="rounded-[30px] border border-white/10 bg-[#121212] px-5 py-8 sm:px-7 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Como funciona</p>
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.6rem]">Empieza rapido y cobra con orden</h2>
          <p className="mt-4 text-base leading-7 text-[#B3B3B3]">
            Sin vueltas ni tecnicismos. Configuras lo basico y desde ahi controlas todo mucho mas facil.
          </p>

          <div className="mt-7 grid gap-3">
            {steps.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-[22px] border border-white/10 bg-[#0F0F0F] px-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#00C896] text-sm font-semibold text-[#0B0B0B]">
                  {index + 1}
                </div>
                <p className="pt-1 text-sm leading-7 text-white">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-7">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex min-h-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition hover:border-[#00C896] hover:text-[#00C896]"
            >
              Probar gratis
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0E0E0E]">
            <img src={feesPreview} alt="Pantalla de cuotas y estados de pago." className="h-full w-full object-cover" />
          </div>
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0E0E0E]">
            <img src={createFeePreview} alt="Carga simple de cuotas y pagos." className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}
