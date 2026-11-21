'use client';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { I18nProvider, useI18n, type Lang } from '@/lib/i18n';
import { LangMenu } from './LangMenu';

/** Signed-out visitors see the welcome screen; the app itself needs an account. */
function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { isLoaded, isSignedIn } = useAuth();
  const path = usePathname();

  if (path.startsWith('/sign-in') || path.startsWith('/sign-up')) return <>{children}</>;
  if (!isLoaded) return null;
  if (isSignedIn) return <>{children}</>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6">
      <div className="flex justify-end">
        <LangMenu />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold leading-tight">{t('appName')}</h1>
          <p className="text-xl leading-relaxed text-dim">{t('welcome')}</p>
        </div>
        <ul className="flex flex-col gap-3 text-lg">
          {(['welcome1', 'welcome2', 'welcome3'] as const).map((k) => (
            <li key={k} className="flex gap-3">
              <span className="text-mine" aria-hidden>✓</span>
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          <Link href="/sign-up" className="btn btn-primary min-h-16 text-2xl">
            {t('signUp')}
          </Link>
          <Link href="/sign-in" className="btn text-lg">
            {t('haveAccount')}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function Providers({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  return (
    <I18nProvider initialLang={initialLang}>
      <AuthGate>{children}</AuthGate>
    </I18nProvider>
  );
}
