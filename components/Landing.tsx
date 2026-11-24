'use client';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { LangMenu } from './LangMenu';
import { Chevron } from './ui';

/**
 * Animated evening-sky clouds (Vanta.js). Loaded only on this page; without WebGL,
 * or when the visitor prefers reduced motion, the static gradient underneath stays.
 */
function Clouds() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let effect: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [THREE, { default: CLOUDS }] = await Promise.all([import('three'), import('vanta/dist/vanta.clouds.min')]);
        if (cancelled || !el.current) return;
        effect = CLOUDS({
          el: el.current,
          THREE,
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          speed: 0.6,
          backgroundColor: 0x0e1014,
          skyColor: 0x1d3a66,
          cloudColor: 0x8fa3c8,
          cloudShadowColor: 0x101726,
          sunColor: 0xfbbf24,
          sunGlareColor: 0xf9824c,
          sunlightColor: 0xfcd9a0,
        });
      } catch {
        // keep the gradient
      }
    })();
    return () => {
      cancelled = true;
      effect?.destroy();
    };
  }, []);
  return <div ref={el} aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1d3a66] via-[#2b3f63] to-[#0e1014]" />;
}

function Choice({ href, primary, title, subtitle, icon }: { href: string; primary?: boolean; title: string; subtitle: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex min-h-20 items-center gap-4 rounded-2xl border px-4 py-3 text-start transition-transform active:scale-[0.98] ${
        primary ? 'border-transparent bg-mine text-[#1a1300] shadow-lg shadow-black/30' : 'border-white/25 bg-white/10 text-ink hover:bg-white/15'
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${primary ? 'bg-black/10' : 'bg-white/15'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold leading-tight">{title}</span>
        <span className={`block ${primary ? 'text-[#1a1300]/75' : 'text-ink/75'}`}>{subtitle}</span>
      </span>
      <Chevron className="text-2xl opacity-70" />
    </Link>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** What signed-out visitors see: sign in or create an account. */
export default function Landing() {
  const { t } = useI18n();
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Clouds />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-bg/80" aria-hidden />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <div className="flex justify-end">
          <LangMenu />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-8">
          {/* On wide screens the heading sits over the bright clouds, so it is dark there. */}
          <div className="flex flex-col items-center gap-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="" width={160} height={160} className="h-40 w-40 rounded-[2rem] shadow-xl shadow-black/40" />
            <h1 className="mt-4 text-4xl font-bold leading-tight drop-shadow-lg md:text-bg md:drop-shadow-none">{t('appName')}</h1>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-bg/45 p-4 backdrop-blur-md">
            <Choice
              href="/sign-in"
              title={t('haveAccountTitle')}
              subtitle={t('signIn')}
              icon={
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden {...stroke} className="rtl:-scale-x-100">
                  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                  <path d="M4 12h11" />
                  <path d="M11 8l4 4-4 4" />
                </svg>
              }
            />
            <Choice
              primary
              href="/sign-up"
              title={t('signUp')}
              subtitle={t('newHere')}
              icon={
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden {...stroke}>
                  <circle cx="10" cy="8" r="4" />
                  <path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" />
                  <path d="M19 5v6M16 8h6" />
                </svg>
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
