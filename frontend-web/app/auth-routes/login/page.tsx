// app/auth-routes/login/page.tsx
'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Map,
  Radio,
  Route,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api } from '@/lib/services/api';
import { defaultRouteForRole, normalizeRole } from '@/lib/auth/rbac';
import { LangToggle } from '@/components/ui/LangToggle';

const capabilities = [
  { icon: Map, label: 'Indoor GIS' },
  { icon: Route, label: 'Rotas multi-piso' },
  { icon: Radio, label: 'Despacho em tempo real' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, isLoading, user, hydrated, error, clearError } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || !user) return;

    let cancelled = false;
    void api.me()
      .then((session) => {
        if (cancelled) return;
        router.replace(defaultRouteForRole(normalizeRole(session.role)));
      })
      .catch(() => {
        // Persisted profile data without a valid cookie is ignored on login.
      });

    return () => {
      cancelled = true;
    };
  }, [user, hydrated, router]);

  useEffect(() => {
    if (hydrated) return;

    const timeoutId = window.setTimeout(() => setHydrationTimedOut(true), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated]);

  if (!hydrated && !hydrationTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7F4]">
        <div className="text-center text-[#17313A]">
          <BrandMark size="large" />
          <p className="mt-5 text-[10px] font-bold tracking-[0.28em] text-[#6F878D]">A PREPARAR O SEU TURNO</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = 'Introduza o seu email institucional.';
    if (!password) newErrors.password = 'Introduza a sua palavra-passe.';
    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);

    setErrors({});
    clearError();
    const success = await login(email, password);
    if (success) {
      router.replace(defaultRouteForRole(useAuthStore.getState().user?.role));
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-x-hidden bg-[#F5F7F4] text-[#17313A]">
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(73,111,119,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(73,111,119,0.07)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute -right-40 -top-28 h-96 w-96 rounded-full bg-[#DCEEEA] blur-3xl" />
      <div className="absolute -bottom-24 -left-44 h-80 w-80 rounded-full bg-[#FDE7C0]/70 blur-3xl" />

      <section className="relative mx-auto flex min-h-[100svh] max-w-[1380px]">
        <SupervisorDesktopPanel />

        <div className="mobile-safe-login flex min-h-[100svh] w-full flex-col px-5 pb-7 pt-6 sm:px-8 lg:w-[560px] lg:shrink-0 lg:basis-[560px] lg:justify-center lg:px-14 lg:py-12">
          <header className="flex items-center justify-between gap-3 lg:hidden">
            <BrandLockup />
            <div className="flex items-center gap-2">
              <StatusPill className="max-[370px]:hidden" />
              <LangToggle className="border-[#D5E8E4] bg-white/80 px-2.5 text-xs" />
            </div>
          </header>

          <div className="mt-auto pb-6 pt-10 sm:mx-auto sm:w-full sm:max-w-[430px] lg:my-auto lg:py-0">
            <div className="mb-8 lg:hidden">
              <p className="mb-3 text-[10px] font-bold tracking-[0.3em] text-[#F3A63A]">ACESSO DA EQUIPA</p>
              <h1 className="max-w-xs text-[2.45rem] font-bold leading-[1.02] tracking-[-0.055em] text-[#17313A]">
                Pronto para o próximo turno.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#647D84]">
                Acesso rápido à coordenação operacional, mapa indoor e alertas em tempo real.
              </p>
            </div>

            <div className="rounded-[26px] border border-[#E1E9E7] bg-white/95 p-5 shadow-[0_24px_70px_rgba(42,74,78,0.14)] backdrop-blur-xl sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold tracking-[0.24em] text-[#F3A63A]">IDENTIDADE OPERACIONAL</p>
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#17313A]">Iniciar sessão</h2>
                  <p className="mt-2 text-xs leading-5 text-[#6B8389]">O perfil da sua equipa é aplicado automaticamente.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D9ECE7] bg-[#EDF8F5] text-[#07826B]">
                  <Fingerprint size={22} />
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleLogin}>
                <FormField
                  id="email"
                  label="EMAIL INSTITUCIONAL"
                  type="email"
                  autoComplete="username"
                  value={email}
                  placeholder="nome@opslite.pt"
                  error={errors.email}
                  icon={<UserRound size={17} />}
                  onChange={(value) => {
                    setEmail(value);
                    setErrors((previous) => ({ ...previous, email: undefined }));
                  }}
                />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-[10px] font-bold tracking-[0.17em] text-[#617A81]">
                      PALAVRA-PASSE
                    </label>
                    <button type="button" className="text-[11px] font-semibold text-[#087A66] transition hover:text-[#055D4D]">
                      Recuperar acesso
                    </button>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8AA0A5]" size={17} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((previous) => ({ ...previous, password: undefined }));
                      }}
                      className={`w-full rounded-xl border bg-[#F8FAF9] py-3.5 pl-10 pr-11 text-sm text-[#17313A] outline-none transition placeholder:text-[#98A9AD] focus:border-[#15977F] focus:ring-4 focus:ring-[#15977F]/10 ${errors.password ? 'border-red-400' : 'border-[#D8E3E1]'}`}
                      placeholder="Introduza a sua palavra-passe"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8AA0A5] transition hover:text-[#17313A]"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1.5 text-xs text-red-300">{errors.password}</p>}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#F39A2E] px-5 py-3.5 text-sm font-bold text-[#10232B] shadow-[0_14px_28px_rgba(243,154,46,0.2)] transition hover:bg-[#FFAE48] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? 'A autenticar...' : 'Entrar no sistema'}
                  {!isLoading && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
                </button>
              </form>

              <div className="mt-5 flex items-center gap-2.5 border-t border-[#E5ECEA] pt-4 text-[11px] leading-4 text-[#72898F]">
                <ShieldCheck className="shrink-0 text-[#087A66]" size={16} />
                <p>Autenticação centralizada e permissões protegidas por Keycloak.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-semibold tracking-[0.12em] text-[#738A90]">
              <span>OPS LITE</span>
              <span className="h-1 w-1 rounded-full bg-[#F3A63A]" />
              <span>OPERAÇÕES DA EQUIPA</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function BrandMark({ size = 'regular' }: { size?: 'regular' | 'large' }) {
  return (
    <div className={`${size === 'large' ? 'h-16 w-16 text-2xl' : 'h-11 w-11 text-lg'} flex items-center justify-center rounded-2xl bg-[#F39A2E] font-black text-[#17313A] shadow-[0_14px_28px_rgba(243,154,46,0.2)]`}>
      O
    </div>
  );
}

function BrandLockup() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark />
      <div className="min-w-0">
        <p className="text-lg font-bold tracking-[-0.02em] text-[#17313A]">OpsLite</p>
        <p className="text-[8px] font-bold tracking-[0.2em] text-[#F3A63A] sm:text-[9px] sm:tracking-[0.26em]">OPERAÇÕES NO TERRENO</p>
      </div>
    </div>
  );
}

function StatusPill({ className = '' }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[#D5E8E4] bg-white/80 px-2.5 py-1.5 text-[10px] font-semibold text-[#5C777E] ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#1FB48E] shadow-[0_0_10px_#67D9BB]" />
      online
    </div>
  );
}

function SupervisorDesktopPanel() {
  return (
    <div className="relative hidden min-w-0 flex-1 overflow-hidden border-r border-[#E1E8E6] bg-white/45 px-16 py-12 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-28 top-28 h-[430px] w-[430px] rounded-full border border-[#CFE1DE]" />
      <div className="absolute -right-12 top-44 h-[310px] w-[310px] rounded-full border border-[#D6E6E3]" />
      <div className="absolute -bottom-56 -left-36 h-[500px] w-[500px] rounded-full bg-[#DCEEEA]" />

      <div className="relative flex items-center justify-between">
        <BrandLockup />
        <div className="flex items-center gap-3">
          <StatusPill />
          <LangToggle className="border-[#D5E8E4] bg-white/80" />
        </div>
      </div>

      <div className="relative max-w-2xl">
        <p className="mb-5 text-[11px] font-bold tracking-[0.34em] text-[#F3A63A]">ÁREA WEB DO SUPERVISOR</p>
        <h1 className="max-w-xl text-[4rem] font-bold leading-[0.98] tracking-[-0.065em] text-[#17313A]">
          Uma visão clara de cada operação.
        </h1>
        <p className="mt-7 max-w-lg text-base leading-7 text-[#647D84]">
          Supervisão do estádio, coordenação de equipas e resposta a incidentes com contexto indoor em tempo real.
        </p>

        <div className="mt-11 flex gap-3">
          {capabilities.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-full border border-[#D5E5E2] bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#536F76] shadow-sm">
              <Icon size={15} className="text-[#F3A63A]" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex items-center gap-2 border-t border-[#DCE6E4] pt-6 text-xs text-[#71898F]">
        <CheckCircle2 size={15} className="text-[#15977F]" />
        <span>Serviços operacionais monitorizados</span>
      </div>
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  placeholder: string;
  error?: string;
  icon: React.ReactNode;
  onChange: (value: string) => void;
}

function FormField({ id, label, type, autoComplete, value, placeholder, error, icon, onChange }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[10px] font-bold tracking-[0.17em] text-[#617A81]">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8AA0A5]">{icon}</span>
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border bg-[#F8FAF9] py-3.5 pl-10 pr-4 text-sm text-[#17313A] outline-none transition placeholder:text-[#98A9AD] focus:border-[#15977F] focus:ring-4 focus:ring-[#15977F]/10 ${error ? 'border-red-400' : 'border-[#D8E3E1]'}`}
          placeholder={placeholder}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
