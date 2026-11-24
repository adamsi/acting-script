'use client';
import Link from 'next/link';
import { use } from 'react';
import { useI18n } from '@/lib/i18n';
import { STEPS, STEPS_SOURCE } from '@/lib/steps';
import { STEP_DETAILS } from '@/lib/steps-detail';
import { Page, TopBar } from '@/components/ui';

/** One step of the 12, with its full explanation (the explanation exists in Hebrew only). */
export default function Step({ params }: { params: Promise<{ n: string }> }) {
  const { t, lang } = useI18n();
  const n = Number(use(params).n);
  const step = STEPS[n - 1];
  const i = lang === 'he' ? 0 : 1;
  if (!Number.isInteger(n) || !step) {
    return (
      <>
        <TopBar title={t('toolSteps')} back="/steps" />
        <Page>
          <p className="p-8 text-center text-xl text-dim">{t('stepsNotFound')}</p>
        </Page>
      </>
    );
  }
  return (
    <>
      <TopBar title={`${t('stepWord')} ${n}`} back="/steps" />
      <Page>
        <article className="card p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mine/15 text-2xl font-bold tabular-nums text-mine" aria-hidden>
              {n}
            </span>
            <h1 className="min-w-0 flex-1 text-3xl font-bold leading-snug">{step.title[i]}</h1>
          </div>
          {lang !== 'he' && <p className="mt-4 text-lg leading-relaxed text-ink/85">{step.text[1]}</p>}
          <div className="mt-4 flex flex-col gap-3" dir="rtl" lang="he">
            {STEP_DETAILS[n - 1].map((b, k) =>
              b.h ? (
                <h2 key={k} className="mt-3 text-xl font-bold text-mine">
                  {b.t}
                </h2>
              ) : (
                <p key={k} className="text-lg leading-relaxed" dir="auto">
                  {b.t}
                </p>
              )
            )}
          </div>
        </article>
        <nav className="flex gap-3">
          {n > 1 ? (
            <Link href={`/steps/${n - 1}`} className="btn min-w-0 flex-1" rel="prev">
              <span aria-hidden>{lang === 'he' ? '›' : '‹'}</span>&nbsp;<span className="truncate">{STEPS[n - 2].title[i]}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {n < STEPS.length ? (
            <Link href={`/steps/${n + 1}`} className="btn btn-primary min-w-0 flex-1" rel="next">
              <span className="truncate">{STEPS[n].title[i]}</span>&nbsp;<span aria-hidden>{lang === 'he' ? '‹' : '›'}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
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
