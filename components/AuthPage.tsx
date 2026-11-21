'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { LangMenu } from './LangMenu';

/** Frame around Clerk's sign-in / sign-up forms. */
export function AuthPage({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-2xl font-bold">
          {t('appName')}
        </Link>
        <LangMenu />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">{children}</div>
    </main>
  );
}
