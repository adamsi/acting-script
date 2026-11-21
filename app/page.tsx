'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { Usage } from '@/lib/limits-types';
import type { ScriptSummary } from '@/lib/types';
import { Page, Status, TopBar } from '@/components/ui';

export default function Home() {
  const { t, lang } = useI18n();
  const [scripts, setScripts] = useState<ScriptSummary[] | null>(null);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(() => {
    setError('');
    api<ScriptSummary[]>('/scripts').then(setScripts, (e) => setError(e.message));
    api<Usage>('/usage').then(setUsage, () => {});
  }, []);
  useEffect(load, [load]);

  const atLimit = !!usage && usage.used >= usage.limit;

  return (
    <>
      <TopBar title={t('myScenes')} />
      <Page>
        {!scripts ? (
          <Status error={error} onRetry={load} />
        ) : scripts.length === 0 ? (
          <p className="p-8 text-center text-xl text-dim">{t('noScenes')}</p>
        ) : (
          scripts.map((s) => (
            <Link key={s.id} href={`/s/${s.id}`} className="card block p-5 active:bg-card2">
              <p className="text-2xl font-bold leading-snug" dir="auto">
                {s.title || '—'}
              </p>
              <p className="mt-1 text-dim">
                {s.author && <span dir="auto">{s.author} · </span>}
                {s.line_count} {t('linesCount')}
                {s.my_name && (
                  <>
                    {' · '}
                    {t('iAm')} <b className="text-mine">{s.my_name}</b>
                  </>
                )}
              </p>
            </Link>
          ))
        )}
      </Page>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {usage && (
            <p className={`text-center text-sm ${atLimit ? 'text-red-300' : 'text-dim'}`}>
              {atLimit
                ? `${t('limitReached')} · ${t('limitResets')}${new Date(usage.resets).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
                : `${usage.used}/${usage.limit} ${t('usage')}`}
            </p>
          )}
          {atLimit ? (
            <button className="btn btn-primary w-full text-xl" disabled>
              + {t('newScene')}
            </button>
          ) : (
            <Link href="/new" className="btn btn-primary flex w-full text-xl">
              + {t('newScene')}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
