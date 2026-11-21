'use client';
import { useAuth } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { I18nProvider, type Lang } from '@/lib/i18n';
import Landing from './Landing';

/** Signed-out visitors see the welcome screen; the app itself needs an account. */
function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const path = usePathname();

  if (path.startsWith('/sign-in') || path.startsWith('/sign-up')) return <>{children}</>;
  if (!isLoaded) return null;
  if (isSignedIn) return <>{children}</>;
  return <Landing />;
}

export default function Providers({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  return (
    <I18nProvider initialLang={initialLang}>
      <AuthGate>{children}</AuthGate>
    </I18nProvider>
  );
}
