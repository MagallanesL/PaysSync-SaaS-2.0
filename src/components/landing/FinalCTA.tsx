export function FinalCTA({ onPrimaryClick }: { onPrimaryClick: () => void }) {
  return (
    <section className="rounded-[34px] border border-[#00C896]/20 bg-[linear-gradient(180deg,rgba(0,200,150,0.12),rgba(11,11,11,0.98))] px-5 py-10 text-center sm:px-7 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Listo para ordenar tus cobros</p>
      <h2 className="mx-auto mt-4 max-w-4xl text-[2rem] font-semibold leading-tight text-white sm:text-[2.9rem]">
        Crea tu cuenta y empieza a cobrar con mas control desde hoy
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#B3B3B3]">
        Menos tiempo persiguiendo pagos. Mas tiempo haciendo crecer tu academia.
      </p>
      <button
        type="button"
        onClick={onPrimaryClick}
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[18px] bg-[#00C896] px-8 py-3 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110"
      >
        Crear cuenta
      </button>
    </section>
  );
}
