import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthEntryPanel } from "../components/auth/AuthEntryPanel";
import paysyncLogo from "../asset/logo_paysync.png";
import { FinalCTA } from "../components/landing/FinalCTA";
import { Hero } from "../components/landing/Hero";
import { HowItWorks } from "../components/landing/HowItWorks";
import { Pricing } from "../components/landing/Pricing";
import { ProblemSection } from "../components/landing/ProblemSection";
import { SolutionSection } from "../components/landing/SolutionSection";
import { Testimonials } from "../components/landing/Testimonials";
import { db } from "../lib/firebase";
import {
  DEFAULT_PLATFORM_CONFIG,
  getPlanPrice,
  normalizePlatformConfig,
  type PlatformConfig
} from "../lib/plans";

export function MarketingLandingPage() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | null>(null);

  useEffect(() => {
    async function loadPlatformConfig() {
      const configSnap = await getDoc(doc(db, "platform", "config"));
      setConfig(normalizePlatformConfig(configSnap.exists() ? configSnap.data() : undefined));
    }

    void loadPlatformConfig();
  }, []);

  const startingMonthlyPrice = useMemo(() => getPlanPrice(config, "basic"), [config]);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,200,150,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_22%)]" />

      {authModalMode && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/82 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="mx-auto w-full max-w-6xl py-2 sm:py-0">
            <AuthEntryPanel initialMode={authModalMode} embedded onRequestClose={() => setAuthModalMode(null)} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-20">
        <header className="sticky top-0 z-30 mb-8 border-b border-white/5 bg-[#0B0B0B]/90 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={paysyncLogo}
                alt="PaySync"
                className="h-12 w-12 rounded-[14px] border border-white/10 bg-white/5 object-cover p-1"
              />
              <div>
                <p className="text-2xl font-semibold text-white">PaySync</p>
                <p className="mt-1 text-sm text-[#B3B3B3]">Cobros mensuales claros para academias</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#como-funciona" className="text-sm text-[#B3B3B3] transition hover:text-white">
                Ver como funciona
              </a>
              <button
                type="button"
                onClick={() => setAuthModalMode("login")}
                className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-white transition hover:border-[#00C896] hover:text-[#00C896]"
              >
                Ingresar
              </button>
              <button
                type="button"
                onClick={() => setAuthModalMode("register")}
                className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#00C896] px-4 py-2 text-sm font-semibold text-[#0B0B0B] transition hover:brightness-110"
              >
                Crear cuenta
              </button>
            </div>
          </div>
        </header>

        <main className="grid gap-6 sm:gap-8">
          <Hero
            trialDays={config.trialDurationDays}
            onPrimaryClick={() => setAuthModalMode("register")}
            onSecondaryClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
          />
          <ProblemSection />
          <SolutionSection onPrimaryClick={() => setAuthModalMode("register")} />
          <HowItWorks onPrimaryClick={() => setAuthModalMode("register")} />

          <section className="rounded-[30px] border border-white/10 bg-[#121212] px-5 py-8 text-center sm:px-7 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C896]">Impacto inmediato</p>
            <h2 className="mx-auto mt-3 max-w-4xl text-[2rem] font-semibold leading-tight text-white sm:text-[2.8rem]">
              Menos tiempo persiguiendo pagos. Mas tiempo ensenando y haciendo crecer tu academia.
            </h2>
          </section>

          <Testimonials onPrimaryClick={() => setAuthModalMode("register")} />
          <Pricing
            trialDays={config.trialDurationDays}
            monthlyPrice={startingMonthlyPrice}
            onPrimaryClick={() => setAuthModalMode("register")}
          />
          <FinalCTA onPrimaryClick={() => setAuthModalMode("register")} />
        </main>

        <footer className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-[#B3B3B3]">
          <p>PaySync para academias, entrenadores, clubes y centros que quieren cobrar con orden.</p>
          <div className="mt-3">
            <Link to="/login" className="transition hover:text-white">
              Si ya tienes cuenta, entra desde la pagina de acceso
            </Link>
          </div>
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0B0B]/95 px-4 py-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={() => setAuthModalMode("register")}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-[16px] bg-[#00C896] px-5 py-3 text-sm font-semibold text-[#0B0B0B]"
        >
          Empezar gratis
        </button>
      </div>
    </div>
  );
}
