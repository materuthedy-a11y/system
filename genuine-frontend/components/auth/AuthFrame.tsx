import Link from 'next/link';
import Image from 'next/image';
import { AuthLeftPanel } from '@/components/auth/AuthLeftPanel';

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen min-h-[100dvh] min-w-0 bg-[#f7f7f4] md:grid md:grid-cols-2">
      <AuthLeftPanel />

      <section className="auth-form-backdrop relative isolate flex min-h-screen min-h-[100dvh] min-w-0 flex-col overflow-hidden px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] [padding-top:max(1rem,env(safe-area-inset-top))] sm:px-8 sm:py-6 md:px-8 lg:px-20">
        <video
          className="auth-background-video absolute inset-0 -z-20 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/auth_background.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-[#101810]/45" aria-hidden="true" />

        <Link href="/login" aria-label="Mizania home" className="mx-auto flex w-full max-w-sm items-center md:hidden">
          <Image
            src="/MIZANIA_BRAND_PACKAGE/logos/svg/wordmark-dark.svg"
            alt="Mizania — Rekodi, fuatilia, endelea"
            width={900}
            height={220}
            priority
            className="h-auto w-[156px] min-[390px]:w-[170px]"
          />
        </Link>
        <div className="mx-auto my-auto w-full max-w-sm py-7 sm:py-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d8f04b]">{eyebrow}</p>
          <h2 className="text-[1.7rem] font-semibold leading-tight tracking-tight text-white min-[390px]:text-3xl sm:text-[2.1rem]">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 border-t border-white/25 pt-4 text-[10px] text-white/75 sm:pt-5 sm:text-[11px]">
          <span>© 2026 Mizania</span>
          <span>Secure business access</span>
        </div>
      </section>
    </main>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <div role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{message}</div>;
}

export function AuthField({
  label,
  id,
  type = 'text',
  autoComplete,
  placeholder,
  value,
  onChange,
  disabled,
  suffix,
  required = true,
  maxLength,
}: {
  label: string;
  id: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  suffix?: React.ReactNode;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-white">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          className={`h-12 w-full rounded-xl border border-[#dfe1db] bg-white px-4 text-sm text-[#20231f] shadow-sm shadow-black/[0.02] transition placeholder:text-[#a4a69f] hover:border-[#c8cbc3] focus:border-[#8aa91a] focus:outline-none focus:ring-4 focus:ring-[#d8f04b]/15 disabled:cursor-not-allowed disabled:bg-[#f4f5f1] ${suffix ? 'pr-12' : ''}`}
        />
        {suffix}
      </div>
    </div>
  );
}

export function SubmitButton({ children, loading = false }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#20211f] px-5 text-sm font-semibold text-white shadow-lg shadow-[#20211f]/15 transition hover:bg-[#363a33] focus:outline-none focus:ring-4 focus:ring-[#20211f]/20 disabled:cursor-wait disabled:opacity-70">
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
