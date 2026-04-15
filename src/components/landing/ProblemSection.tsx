const problems = [
  "No sabes quien pago y quien no",
  "Pierdes tiempo persiguiendo pagos",
  "Todo depende de tu memoria"
];

export function ProblemSection() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[#121212] px-5 py-8 sm:px-7 sm:py-10">
      <SectionIntro
        eyebrow="Lo que pasa hoy"
        title="El problema no es cobrar. El problema es cobrar asi."
        description="Si hoy gestionas tus cobros con Excel, WhatsApp y recordatorios manuales, ya sabes lo dificil que es mantener todo al dia."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {problems.map((problem, index) => (
          <div key={problem} className="rounded-[22px] border border-white/10 bg-[#0F0F0F] p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#00C896]/10 text-lg font-semibold text-[#00C896]">
              0{index + 1}
            </div>
            <p className="mt-4 text-sm leading-7 text-white">{problem}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">{eyebrow}</p>
      <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.6rem]">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#B3B3B3]">{description}</p>
    </div>
  );
}
