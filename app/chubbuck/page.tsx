'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, apiBlob, draftFromParsed } from '@/lib/client';
import { errorText, useI18n } from '@/lib/i18n';
import type { Draft } from '@/lib/types';
import { LinesEditor } from '@/components/Editor';
import { Page, ProgressCard, Stepper, TopBar } from '@/components/ui';

const MAX_BYTES = 4 * 1024 * 1024;

export default function Chubbuck() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'' | 'parse' | 'build'>('');
  const [error, setError] = useState('');
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);

  const setDraft = (fn: (d: Draft) => Draft) => setDraftState((d) => (d ? fn(d) : d));
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  useEffect(() => () => void (download && URL.revokeObjectURL(download.url)), [download]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError('');
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) return setError(t('unsupported'));
    if (f.size > MAX_BYTES) return setError(t('tooBig'));
    setFileName(f.name);
    setBusy('parse');
    try {
      const form = new FormData();
      form.append('file', f);
      const parsed = await api<Parameters<typeof draftFromParsed>[0]>('/scripts/parse?for=table', { method: 'POST', body: form });
      setDraftState(draftFromParsed(parsed, []));
      setStep(1);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy('');
    }
  }

  async function build() {
    if (!draft) return;
    setError('');
    setBusy('build');
    try {
      const nameOf = new Map(draft.characters.map((c) => [c.key, c.name.trim()]));
      const blob = await apiBlob('/chubbuck', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title,
          author: draft.author,
          lines: draft.lines.map((l) => ({ speaker: nameOf.get(l.speaker) || '', text: l.text })),
        }),
      });
      const safe = (draft.title || 'scene').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80);
      setDownload({ url: URL.createObjectURL(blob), name: `${safe} - טבלת צ׳באק.docx` });
      setStep(2);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy('');
    }
  }

  const valid = !!draft && draft.lines.length > 0 && draft.lines.every((l) => l.text.trim()) && draft.characters.every((c) => c.name.trim());

  return (
    <>
      <TopBar title={t('toolChubbuck')} back="/" />
      <Page>
        <Stepper steps={[t('stepUpload'), t('stepCheck'), t('stepDownload')]} current={step} />
        {error && <p className="card border-red-400/50 p-4 text-red-300" dir="auto">{error}</p>}

        {busy === 'parse' && <ProgressCard title={t('analyzing')} hint={fileName} estimateMs={40000} />}
        {busy === 'build' && <ProgressCard title={t('creatingTable')} estimateMs={4000} />}

        {!busy && step === 0 && (
          <label className="card flex cursor-pointer flex-col items-center gap-4 p-10 text-center">
            <span className="text-6xl" aria-hidden>📄</span>
            <span className="text-xl text-dim">{t('uploadHint')}</span>
            <span className="text-dim">{t('uploadLimits')}</span>
            <span className="btn btn-primary text-xl">{t('chooseFile')}</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {!busy && step === 1 && draft && (
          <>
            <input className="field text-2xl font-bold" dir="auto" aria-label={t('title')} placeholder={t('title')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            <input className="field" dir="auto" aria-label={t('author')} placeholder={t('author')} value={draft.author} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />

            <h2 className="mt-2 text-xl font-bold">{t('characters')}</h2>
            <div className="flex flex-wrap gap-2">
              {draft.characters.map((c) => (
                <input
                  key={c.key}
                  className="field w-40 font-bold text-other"
                  dir="auto"
                  aria-label={t('name')}
                  value={c.name}
                  onChange={(e) => setDraft((d) => ({ ...d, characters: d.characters.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)) }))}
                />
              ))}
            </div>

            <p className="mt-2 text-xl font-semibold">{t('checkTable')}</p>
            <LinesEditor draft={draft} setDraft={setDraft} />
          </>
        )}

        {!busy && step === 2 && download && (
          <div className="card flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-other/15 text-4xl text-other" aria-hidden>✓</span>
            <p className="text-2xl font-bold">{t('tableReady')}</p>
            <p className="text-dim">
              {draft?.lines.length} {t('rowsCount')} · {t('tableReadyHint')}
            </p>
            <a className="btn btn-primary w-full text-xl" href={download.url} download={download.name}>
              ⬇ {t('download')}
            </a>
            <button className="btn w-full" onClick={() => setStep(1)}>
              {t('backToEdit')}
            </button>
            <button
              className="btn w-full"
              onClick={() => {
                setDraftState(null);
                setDownload(null);
                setStep(0);
              }}
            >
              + {t('anotherTable')}
            </button>
            <Link href="/" className="text-dim underline">
              {t('home')}
            </Link>
          </div>
        )}
      </Page>

      {!busy && step === 1 && draft && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button className="btn" onClick={() => setStep(0)}>
              {t('previous')}
            </button>
            <button className="btn btn-primary flex-1 text-xl" disabled={!valid} onClick={build}>
              ✓ {t('createTable')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
