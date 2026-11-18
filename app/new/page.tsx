'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, draftFromParsed, ensureAudio } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { Draft, Script, Voice } from '@/lib/types';
import { CharactersEditor, LinesEditor, draftProblem } from '@/components/Editor';
import { Overlay, Page, TopBar } from '@/components/ui';

const MAX_BYTES = 4 * 1024 * 1024;

export default function NewScene() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [busy, setBusy] = useState<'' | 'parse' | 'save' | 'record'>('');
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [error, setError] = useState('');

  const setDraft = (fn: (d: Draft) => Draft) => setDraftState((d) => (d ? fn(d) : d));
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError('');
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) return setError(t('unsupported'));
    if (f.size > MAX_BYTES) return setError(t('tooBig'));
    setFile(f);
    setBusy('parse');
    try {
      const form = new FormData();
      form.append('file', f);
      const parsed = await api<Parameters<typeof draftFromParsed>[0]>('/scripts/parse', { method: 'POST', body: form });
      const v = await api<Voice[]>(`/voices?lang=${parsed.language}`);
      setVoices(v);
      setDraftState(draftFromParsed(parsed, v));
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!draft) return;
    setError('');
    setBusy('save');
    try {
      const form = new FormData();
      form.append('data', JSON.stringify(draft));
      if (file) form.append('file', file);
      const { id } = await api<{ id: string }>('/scripts', { method: 'POST', body: form });
      const script = await api<Script>(`/scripts/${id}`);
      setBusy('record');
      await ensureAudio(script, {}, (d, n) => setProgress([d, n]));
      router.replace(`/s/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  }

  const charsOk = !!draft && !!draft.my && draft.characters.every((c) => c.name.trim() && (c.key === draft.my || c.voice_id));

  return (
    <>
      <TopBar title={step === 0 ? t('uploadTitle') : `${step}/2 · ${step === 1 ? t('stepCharacters') : t('stepLines')}`} back="/" />
      <Page>
        {error && <p className="card border-red-400/50 p-4 text-red-300" dir="auto">{error}</p>}

        {step === 0 && (
          <label className="card flex cursor-pointer flex-col items-center gap-4 p-10 text-center">
            <span className="text-6xl" aria-hidden>📄</span>
            <span className="text-xl text-dim">{t('uploadHint')}</span>
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

        {step === 1 && draft && (
          <>
            <input className="field text-2xl font-bold" dir="auto" aria-label={t('title')} placeholder={t('title')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            <input className="field" dir="auto" aria-label={t('author')} placeholder={t('author')} value={draft.author} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />
            <p className="text-xl font-semibold">{t('checkCharacters')}</p>
            <CharactersEditor draft={draft} setDraft={setDraft} voices={voices} />
          </>
        )}

        {step === 2 && draft && (
          <>
            <p className="text-xl font-semibold">{t('checkLines')}</p>
            <LinesEditor draft={draft} setDraft={setDraft} />
          </>
        )}
      </Page>

      {step > 0 && draft && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button className="btn" onClick={() => setStep(step - 1)}>
              {t('previous')}
            </button>
            {step === 1 ? (
              <button className="btn btn-primary flex-1 text-xl" disabled={!charsOk} onClick={() => setStep(2)}>
                {charsOk ? t('next') : t('chooseMe')}
              </button>
            ) : (
              <button className="btn btn-primary flex-1 text-xl" disabled={draftProblem(draft)} onClick={save}>
                ✓ {t('confirmSave')}
              </button>
            )}
          </div>
        </div>
      )}

      {busy === 'parse' && <Overlay title={t('analyzing')} hint={t('analyzingHint')} />}
      {busy === 'save' && <Overlay title={t('saving')} />}
      {busy === 'record' && <Overlay title={t('recording')} done={progress[0]} total={progress[1]} />}
    </>
  );
}
