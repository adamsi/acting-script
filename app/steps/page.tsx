'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { STEPS, STEPS_SOURCE } from '@/lib/steps';
import { Page, TopBar } from '@/components/ui';

/** The 12 steps of the Chubbuck technique: each card opens the step's full explanation. */
export default function Steps() {
  const { t, lang } = useI18n();
  const i = lang === 'he' ? 0 : 1;
  return (
    <>
      <TopBar title={t('toolSteps')} back="/" />
      <Page>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, n) => (
            <li key={n}>
              <Link href={`/steps/${n + 1}`} className="card flex items-center gap-4 p-5 transition-colors hover:border-ink/30 active:bg-card2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-mine/15 text-xl font-bold tabular-nums text-mine" aria-hidden>
                  {n + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-2xl font-bold leading-snug">{s.title[i]}</span>
                  <span className="mt-2 block text-lg leading-relaxed text-ink/85">{s.text[i]}</span>
                  <span className="mt-3 block font-semibold text-other">
                    {t('stepsMore')} {lang === 'he' ? '‹' : '›'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="pb-4 text-center text-sm text-dim">
          {t('stepsSource')}{' '}
          <a href={STEPS_SOURCE} target="_blank" rel="noopener noreferrer" className="underline">
            Chubbuck Israel
          </a>
        </p>
      </Page>
    </>
  );
}
