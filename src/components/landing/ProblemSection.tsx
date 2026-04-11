const problems = [
  "Anotas pagos en Excel o cuadernos",
  "Te mandan comprobantes por WhatsApp",
  "No sabes quien te debe",
  "Tienes que recordar a quien cobrarle"
];

export function ProblemSection() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[#121212] px-5 py-8 sm:px-7 sm:py-10">
      <SectionIntro
        eyebrow="El problema"
        title="Si manejas tu academia asi, estas perdiendo plata"
        description="Cuando los cobros viven repartidos entre chats, planillas y memoria, lo normal es cobrar tarde, olvidarte de alguien o perder tiempo todos los meses."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {problems.map((problem) => (
          <div key={problem} className="rounded-[22px] border border-white/10 bg-[#0F0F0F] p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#00C896]/10 text-lg font-semibold text-[#00C896]">
              !
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
