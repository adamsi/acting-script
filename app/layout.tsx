import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { enUS, heIL } from '@clerk/localizations';
import { dark } from '@clerk/ui/themes';
import { Heebo } from 'next/font/google';
import { cookies } from 'next/headers';
import Providers from '@/components/Providers';
import './globals.css';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' });

export const metadata: Metadata = {
  title: 'צ׳בק',
  description: 'Tools for actors: learn a script with the other characters read aloud, and build a Chubbuck worksheet.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e1014',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Hebrew unless the user chose English (the choice is kept in a cookie so the server knows it).
  const lang = (await cookies()).get('lang')?.value === 'en' ? 'en' : 'he';
  return (
    <html lang={lang} dir={lang === 'he' ? 'rtl' : 'ltr'} className={heebo.variable}>
      <body className="font-sans antialiased">
        <ClerkProvider
          dynamic
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          afterSignOutUrl="/"
          localization={lang === 'he' ? heIL : enUS}
          appearance={{ theme: dark, variables: { colorPrimary: '#fbbf24', colorPrimaryForeground: '#1a1300' } }}
        >
          <Providers initialLang={lang}>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
