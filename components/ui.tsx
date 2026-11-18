'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      className="btn min-h-11 px-3 text-base"
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      aria-label="Switch language"
    >
      {lang === 'he' ? 'English' : 'עברית'}
    </button>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  const { t, lang } = useI18n();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
      {back && (
        <Link href={back} className="btn min-h-11 px-3 text-xl" aria-label={t('back')}>
          {lang === 'he' ? '→' : '←'}
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{title}</h1>
      {right ?? <LangToggle />}
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
