'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ArcSummary } from '@/lib/arc';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { Chevron, Page, Status, TopBar } from '@/components/ui';

/** Character arc: the user's saved analyses, and the way to a new one. */
export default function Arcs() {
  const { t, lang } = useI18n();
  const [arcs, setArcs] = useState<ArcSummary[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    api<ArcSummary[]>('/arcs').then(setArcs, (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <TopBar title={t('toolArc')} back="/" />
      <Page>
        {!arcs ? (
          <Status error={error} onRetry={load} />
        ) : arcs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <h2 className="text-2xl font-bold leading-snug">{t('arcHeading')}</h2>
            <p className="text-lg leading-relaxed text-dim">{t('arcIntro')}</p>
          </div>
        ) : (
          <>
            <h2 className="pt-2 text-xl text-dim">{t('myArcs')}</h2>
            {arcs.map((a) => (
              <Link key={a.id} href={`/arc/${a.id}`} className="card flex items-center gap-4 p-5 transition-colors hover:border-ink/30 active:bg-card2" data-arc>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-2xl font-bold leading-snug" dir="auto">
                    {a.character}
                  </span>
                  <span className="mt-1 block text-dim">
                    {a.scenes} {t('arcScenes')}
                    {a.files > 1 && ` · ${a.files} ${t('arcFilesCount')}`} · {date(a.updated_at)}
                  </span>
                </span>
                <Chevron className="text-2xl text-dim" />
              </Link>
            ))}
          </>
        )}
      </Page>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl">
          <Link href="/arc/new" className="btn btn-primary flex w-full text-xl">
            + {t('arcNew')}
          </Link>
        </div>
      </div>
    </>
  );
}
