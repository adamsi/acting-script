'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { AUTH_EVENT, checkPasskey, getPasskey, setPasskey } from '@/lib/client';
import { LangToggle } from './ui';

function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<'checking' | 'ok' | 'login'>('checking');
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get('passkey');
      if (fromUrl !== null) {
        url.searchParams.delete('passkey');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      for (const candidate of [fromUrl, getPasskey()]) {
        if (candidate && (await checkPasskey(candidate).catch(() => false))) {
          setPasskey(candidate);
          setState('ok');
          return;
        }
      }
      setState('login');
    })();
    const onFail = () => setState('login');
    window.addEventListener(AUTH_EVENT, onFail);
    return () => window.removeEventListener(AUTH_EVENT, onFail);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await checkPasskey(value.trim()).catch(() => false);
    setBusy(false);
    if (ok) {
      setPasskey(value.trim());
      setState('ok');
    } else setWrong(true);
  }

  if (state === 'checking') return null;
  if (state === 'ok') return <>{children}</>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('appName')}</h1>
        <LangToggle />
      </div>
      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        <label className="text-xl font-semibold" htmlFor="passkey">
          {t('passkeyTitle')}
        </label>
        <input
          id="passkey"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="field text-2xl"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
        />
        {wrong && <p className="text-red-300">{t('passkeyWrong')}</p>}
        <button className="btn btn-primary" disabled={busy || !value.trim()}>
          {t('enter')}
        </button>
      </form>
    </main>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthGate>{children}</AuthGate>
    </I18nProvider>
  );
}
