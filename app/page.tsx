'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useConfig } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { Chevron, Page, TopBar } from '@/components/ui';

function ToolCard({ href, title, desc, tint, icon }: { href: string; title: string; desc: string; tint: string; icon: ReactNode }) {
  return (
    <Link href={href} className="card group flex items-center gap-4 p-5 transition-colors hover:border-ink/30 active:bg-card2">
      <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${tint}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold leading-snug">{title}</span>
        <span className="mt-1 block leading-snug text-dim">{desc}</span>
      </span>
      <Chevron className="text-2xl text-dim" />
    </Link>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export default function Home() {
  const { t } = useI18n();
  const config = useConfig();
  return (
    <>
      <TopBar title={t('appName')} />
      <Page>
        <p className="pt-2 text-xl text-dim">{t('chooseTool')}</p>
        <ToolCard
          href="/learn"
          title={t('toolLearn')}
          desc={t('toolLearnDesc')}
          tint="bg-mine/15 text-mine"
          icon={
            <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden {...stroke}>
              {/* script page with a speech bubble */}
              <path d="M12 6h16l8 8v14" />
              <path d="M28 6v8h8" />
              <path d="M12 6v36h12" />
              <path d="M17 20h12M17 26h8" />
              <path d="M28 32h14v9H36l-4 3v-3h-4z" />
            </svg>
          }
        />
        <ToolCard
          href="/chubbuck"
          title={t('toolChubbuck')}
          desc={t('toolChubbuckDesc')}
          tint="bg-other/15 text-other"
          icon={
            <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden {...stroke}>
              {/* table */}
              <rect x="6" y="9" width="36" height="30" rx="3" />
              <path d="M6 17h36M6 25h36M6 32h36M28 17v22M18 17v22" />
            </svg>
          }
        />
        <ToolCard
          href="/arc"
          title={t('toolArc')}
          desc={t('toolArcDesc')}
          tint="bg-rose-400/15 text-rose-300"
          icon={
            <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden {...stroke}>
              {/* a path through the scenes */}
              <path d="M8 38c6-2 6-12 12-13s6 6 12 3 4-16 8-18" />
              <circle cx="8" cy="38" r="2.5" />
              <circle cx="20" cy="25" r="2.5" />
              <circle cx="32" cy="28" r="2.5" />
              <circle cx="40" cy="10" r="2.5" />
            </svg>
          }
        />
        <ToolCard
          href="/steps"
          title={t('toolSteps')}
          desc={t('toolStepsDesc')}
          tint="bg-emerald-400/15 text-emerald-300"
          icon={
            <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden {...stroke}>
              {/* steps going up */}
              <path d="M6 40h9v-9h9v-9h9v-9h9" />
              <path d="M6 40h36" />
            </svg>
          }
        />
        {config?.admin && (
          <Link href="/admin" className="btn mt-4 self-start">
            ⚙ {t('admin')}
          </Link>
        )}
      </Page>
    </>
  );
}
