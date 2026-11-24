'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useI18n } from '@/lib/i18n';
import { LangMenu } from './LangMenu';

export function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  const { t, lang } = useI18n();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
      {back && (
        <Link href={back} className="btn min-h-11 px-3 text-xl" aria-label={t('back')}>
          {/* back: towards where reading starts - right in Hebrew, left in English. Drawn, so the browser cannot flip it. */}
          <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden data-back-arrow={lang === 'he' ? 'right' : 'left'}>
            <path d={lang === 'he' ? 'M4 12h16M13 5l7 7-7 7' : 'M20 12H4M11 5l-7 7 7 7'} />
          </svg>
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{title}</h1>
      {right ?? (
        <>
          <LangMenu />
          <UserButton />
        </>
      )}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-32">{children}</main>;
}

export function Status({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return <p className="p-8 text-center text-xl text-dim">{t('loading')}</p>;
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-xl text-red-300">{t('error')}</p>
      <p className="text-dim" dir="auto">{error}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}

/** Full-screen blocking progress (recording generation, analysis). */
export function Overlay({ title, hint, done, total }: { title: string; hint?: string; done?: number; total?: number }) {
  const pct = total ? Math.round(((done || 0) / total) * 100) : null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg/95 p-8 text-center" role="status">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-mine" />
      <p className="text-2xl font-semibold">{title}</p>
      {hint && <p className="text-dim">{hint}</p>}
      {pct !== null && (
        <div className="w-full max-w-xs">
          <div className="h-3 overflow-hidden rounded-full bg-card2">
            <div className="h-full bg-mine transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-dim" dir="ltr">
            {done} / {total}
          </p>
        </div>
      )}
    </div>
  );
}

/** Steps of a flow: done steps are filled, the current one is highlighted. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex gap-2" aria-label={steps[current]}>
      {steps.map((s, i) => (
        <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={i === current ? 'step' : undefined}>
          <span className={`h-1.5 rounded-full transition-colors ${i <= current ? 'bg-mine' : 'bg-card2'}`} />
          <span className={`truncate text-center text-sm ${i === current ? 'font-bold text-ink' : i < current ? 'text-ink/70' : 'text-dim'}`}>
            {i < current ? '✓ ' : ''}
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Inline progress card. With done/total it shows real progress; with estimateMs it shows
 * an estimate that eases toward (never reaching) the end until the work actually finishes.
 */
export function ProgressCard({ title, hint, done, total, estimateMs }: { title: string; hint?: string; done?: number; total?: number; estimateMs?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!estimateMs) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(timer);
  }, [estimateMs]);
  const real = total ? (done || 0) / total : null;
  const fraction = real ?? (estimateMs ? 0.95 * (1 - Math.exp((-2.2 * elapsed) / estimateMs)) : 0);
  const pct = Math.round(fraction * 100);
  return (
    <div className="card flex flex-col gap-4 p-6" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold">{title}</p>
        <p className="text-xl font-bold tabular-nums text-mine" dir="ltr">
          {total ? `${done || 0}/${total}` : `${pct}%`}
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-card2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="bar-live h-full rounded-full bg-mine transition-[width] duration-300 ease-out" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      {hint && <p className="text-dim">{hint}</p>}
    </div>
  );
}

/**
 * A chevron that points the way reading goes ("forward": left in Hebrew, right in English) or back.
 * Drawn, not typed: the characters ‹ and › are mirrored by the browser in right-to-left text.
 */
export function Chevron({ back, className = '' }: { back?: boolean; className?: string }) {
  const { lang } = useI18n();
  const left = (lang === 'he') !== !!back;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" className={`inline-block shrink-0 align-[-0.125em] ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden data-chevron={left ? 'left' : 'right'}>
      <path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}
