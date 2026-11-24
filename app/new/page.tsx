'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, draftFromParsed, ensureAudio, useConfig } from '@/lib/client';
import { errorText, useI18n, useUploadLimits, type Key } from '@/lib/i18n';
import { ReadError } from '@/lib/script/types';
import type { Draft, RecordingMode, Script, Voice } from '@/lib/types';
import { CharactersEditor, LinesEditor, draftProblem } from '@/components/Editor';
import { Page, ProgressCard, Stepper, TopBar } from '@/components/ui';

const MAX_BYTES = 4 * 1024 * 1024;

const READ_ERRORS: Record<ReadError['code'], Key> = {
  unsupported: 'unsupported',
  old_doc: 'errOldDoc',
  image: 'errImage',
  empty: 'errEmpty',
  broken: 'errBroken',
};

function ModeCard({ selected, onSelect, title, desc, icon }: { selected: boolean; onSelect: () => void; title: string; desc: string; icon: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`card flex items-center gap-4 p-5 text-start transition-colors ${selected ? 'border-mine bg-mine/10' : 'active:bg-card2'}`}
    >
      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl ${selected ? 'bg-mine/20' : 'bg-card2'}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-bold leading-snug">{title}</span>
        <span className="mt-1 block leading-snug text-dim">{desc}</span>
      </span>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-mine bg-mine text-[#1a1300]' : 'border-line'}`} aria-hidden>
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}

export default function NewScene() {
  const { t } = useI18n();
  const uploadLimits = useUploadLimits();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [recognized, setRecognized] = useState(true);
  // AI voices unless the user chooses to record the other characters themselves.
  const [chosen, setMode] = useState<RecordingMode>('ai');
  const config = useConfig();
  // With AI voices switched off (admin panel) only own recordings are possible.
  const aiVoices = config?.aiVoices !== false;
  const mode: RecordingMode = aiVoices ? chosen : 'own';
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
    if (f.size > MAX_BYTES) return setError(t('tooBig'));
    setFile(f);
    setBusy('parse');
    try {
      // The script is read in the browser, by code: no AI. Stage directions are put in ( ).
      const [{ readScript }, { parseForLearning }] = await Promise.all([import('@/lib/script/read'), import('@/lib/learn-parse')]);
      const parsed = parseForLearning(await readScript(await f.arrayBuffer(), f.name), [t('placeholderA'), t('placeholderB')]);
      const v = await api<Voice[]>(`/voices?lang=${parsed.language}`);
      setVoices(v);
      setRecognized(parsed.recognized);
      setDraftState(draftFromParsed(parsed, v));
      setStep(1);
    } catch (e) {
      setError(e instanceof ReadError ? t(READ_ERRORS[e.code]) : errorText(e, t));
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
      form.append('data', JSON.stringify({ ...draft, recording_mode: mode }));
      if (file) form.append('file', file);
      const { id } = await api<{ id: string }>('/scripts', { method: 'POST', body: form });
      if (mode === 'own') return router.replace(`/s/${id}?record=1`); // the scene page opens the recorder
      const script = await api<Script>(`/scripts/${id}`);
      setBusy('record');
      await ensureAudio(script, {}, (d, n) => setProgress([d, n]));
      router.replace(`/s/${id}`);
    } catch (e) {
      setError(errorText(e, t));
      setBusy('');
    }
  }

  const charsOk = !!draft && !!draft.my && draft.characters.every((c) => c.name.trim() && (c.key === draft.my || c.voice_id));

  return (
    <>
      <TopBar title={t('newScene')} back="/learn" />
      <Page>
        <Stepper
          steps={[t('stepUpload'), t('stepCharacters'), t('stepLines'), t('stepRecord')]}
          current={busy === 'save' || busy === 'record' ? 3 : step}
        />
        {error && <p className="card border-red-400/50 p-4 text-red-300" dir="auto">{error}</p>}

        {busy === 'parse' && <ProgressCard title={t('analyzing')} hint={file?.name} estimateMs={4000} />}
        {busy === 'save' && <ProgressCard title={t('saving')} estimateMs={3000} />}
        {busy === 'record' && <ProgressCard title={t('recording')} hint={t('recordingHint')} done={progress[0]} total={progress[1]} />}

        {!busy && step === 0 && (
          <label className="card flex cursor-pointer flex-col items-center gap-4 p-10 text-center">
            <span className="text-6xl" aria-hidden>📄</span>
            <span className="text-xl text-dim">{t('uploadHint')}</span>
            <span className="text-dim">{uploadLimits}</span>
            <span className="btn btn-primary text-xl">{t('chooseFile')}</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.odt,.rtf,.html,.htm,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/*"
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
            {!recognized && <p className="card border-mine/60 p-4 text-mine">{t('notRecognizedLearn')}</p>}
            <p className="text-xl font-semibold">{t('checkCharacters')}</p>
            {aiVoices && draft.characters.some((c) => c.gender === 'unknown' && c.key !== draft.my) && <p className="text-dim">{t('genderUnknownHint')}</p>}
            <CharactersEditor draft={draft} setDraft={setDraft} voices={voices} voicesEnabled={aiVoices} />
          </>
        )}

        {!busy && step === 2 && draft && (
          <>
            <p className="text-xl font-semibold">{t('checkLines')}</p>
            <LinesEditor draft={draft} setDraft={setDraft} />
          </>
        )}

        {!busy && step === 3 && draft && (
          <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('chooseRecording')}>
            <p className="text-xl font-semibold">{t('chooseRecording')}</p>
            {aiVoices ? (
              <ModeCard selected={mode === 'ai'} onSelect={() => setMode('ai')} icon="✨" title={t('modeAi')} desc={t('modeAiDesc')} />
            ) : (
              <p className="text-dim">{t('aiOff')}</p>
            )}
            <ModeCard selected={mode === 'own'} onSelect={() => setMode('own')} icon="🎙" title={t('modeOwn')} desc={t('modeOwnDesc')} />
          </div>
        )}
      </Page>

      {!busy && step > 0 && draft && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button className="btn" onClick={() => setStep(step - 1)}>
              {t('previous')}
            </button>
            {step === 1 ? (
              <button className="btn btn-primary flex-1 text-xl" disabled={!charsOk} onClick={() => setStep(2)}>
                {charsOk ? t('next') : t('chooseMe')}
              </button>
            ) : step === 2 ? (
              <button className="btn btn-primary flex-1 text-xl" disabled={draftProblem(draft)} onClick={() => setStep(3)}>
                {t('next')}
              </button>
            ) : (
              <button className="btn btn-primary flex-1 text-xl" disabled={draftProblem(draft)} onClick={save}>
                ✓ {t('confirmSave')}
              </button>
            )}
          </div>
        </div>
      )}

    </>
  );
}
