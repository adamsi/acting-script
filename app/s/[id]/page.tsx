'use client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api, ensureAudio, linesToRecord, preloadClips, spokenOf, unlockAudio, useConfig } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { Line, RecordingMode, Script } from '@/lib/types';
import Player from '@/components/Player';
import Recorder from '@/components/Recorder';
import Select from '@/components/Select';
import { Overlay, Page, Status, TopBar } from '@/components/ui';

const RATES = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw));
    } catch {}
  }, [key]);
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
    },
  ];
}

function Scene() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [script, setScript] = useState<Script | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  /** lines being recorded with the microphone (null: recorder closed) */
  const [recording, setRecording] = useState<Line[] | null>(null);
  const [warn, setWarn] = useState('');
  const [memorize, setMemorize] = usePref('memorize', false);
  const [rate, setRate] = usePref('rate', 1);
  const config = useConfig();
  const aiVoices = config?.aiVoices !== false;

  const load = useCallback(() => {
    setError('');
    api<Script>(`/scripts/${id}`).then(setScript, (e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  // Coming from the new-scene wizard with "record myself": open the recorder once the scene is loaded.
  const wantsRecorder = params.get('record') === '1';
  useEffect(() => {
    if (!wantsRecorder || !script) return;
    router.replace(`/s/${id}`);
    setRecording(linesToRecord(script));
  }, [wantsRecorder, script, id, router]);

  // Fetch the first recordings ahead of time, so the rehearsal starts speaking right after Play.
  useEffect(() => {
    if (!script?.my_character_id) return;
    preloadClips(script, 0);
    if (script.last_line_idx > 0) preloadClips(script, script.last_line_idx);
  }, [script]);

  const nameOf = useMemo(() => new Map(script?.characters.map((c) => [c.id, c.name])), [script]);

  /** Starts the rehearsal with the recordings already stored. Never creates recordings. */
  function play(from: number) {
    if (!script?.my_character_id) return;
    unlockAudio(); // must happen inside the tap
    setWarn('');
    setPlayFrom(Math.min(from, script.lines.length - 1));
  }

  /** Creates the missing / outdated AI recordings. Runs only when the user asks for it. */
  async function createAi() {
    if (!script) return;
    setWarn('');
    setProgress([0, 0]);
    const r = await ensureAudio(script, {}, (d, n) => setProgress([d, n]));
    setScript(r.script);
    setProgress(null);
    if (r.failed) setWarn(`${t('recordingFailed')} (${r.failed}): ${r.error}`);
  }

  async function setMe(characterId: string) {
    if (!script) return;
    setScript({ ...script, my_character_id: characterId });
    await api(`/scripts/${id}`, { method: 'PATCH', body: JSON.stringify({ my_character_id: characterId }) }).catch(() => {});
  }

  async function setMode(recording_mode: RecordingMode) {
    if (!script || script.recording_mode === recording_mode) return;
    setScript({ ...script, recording_mode });
    await api(`/scripts/${id}`, { method: 'PATCH', body: JSON.stringify({ recording_mode }) }).catch(() => {});
  }

  async function remove() {
    if (!confirm(t('deleteSceneConfirm'))) return;
    try {
      await api(`/scripts/${id}`, { method: 'DELETE' });
      router.replace('/learn');
    } catch (e) {
      setWarn(e instanceof Error ? e.message : String(e));
    }
  }

  if (!script)
    return (
      <>
        <TopBar title="" back="/learn" />
        <Status error={error} onRetry={load} />
      </>
    );

  const missing = linesToRecord(script);
  // With AI voices switched off (admin panel) the lines can only be recorded by the user.
  const own = script.recording_mode === 'own' || !aiVoices;
  const others = script.my_character_id ? script.lines.filter((l) => l.character_id !== script.my_character_id && !!spokenOf(l)) : [];
  const resumeAt = script.last_line_idx > 0 && script.last_line_idx < script.lines.length ? script.last_line_idx : 0;

  return (
    <>
      <TopBar title={script.title} back="/learn" />
      <Page>
        {script.author && (
          <p className="text-dim" dir="auto">
            {script.author}
          </p>
        )}

        <div className="card flex items-center gap-3 p-4">
          <span className="text-xl font-semibold">{t('iAm')}</span>
          <Select
            className="flex-1 text-xl font-bold text-mine"
            label={t('iAm')}
            value={script.my_character_id || ''}
            options={script.characters.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setMe}
          />
        </div>

        <button className="btn btn-primary min-h-20 text-3xl" disabled={!script.my_character_id || !script.lines.length} onClick={() => play(0)}>
          ▶ {t('play')}
        </button>
        {resumeAt > 0 && (
          <button className="btn text-xl" onClick={() => play(resumeAt)}>
            {t('continueFrom')} {resumeAt + 1}
          </button>
        )}
        {warn && (
          <p className="text-red-300" dir="auto" role="alert">
            {warn}
          </p>
        )}

        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex-1 text-lg font-semibold">{t('recordingsBy')}</span>
            <div className={`rounded-xl border border-line p-1 ${aiVoices ? 'flex' : 'hidden'}`} role="group" aria-label={t('recordingsBy')}>
              {(['ai', 'own'] as const).map((m) => (
                <button
                  key={m}
                  className={`min-h-10 rounded-lg px-3 text-base font-semibold ${script.recording_mode === m ? 'bg-mine text-[#1a1300]' : 'text-dim'}`}
                  aria-pressed={script.recording_mode === m}
                  onClick={() => setMode(m)}
                >
                  {m === 'ai' ? t('modeAi') : t('modeOwn')}
                </button>
              ))}
            </div>
          </div>
          {!aiVoices && <p className="text-dim">{t('aiOff')}</p>}
          {missing.length > 0 && (
            <p className="text-mine">
              {missing.length} {t('needRecording')}
            </p>
          )}
          {own ? (
            <>
              {missing.length > 0 && (
                <button className="btn btn-primary" onClick={() => setRecording(missing)}>
                  🎙 {t('recordMine')} ({missing.length})
                </button>
              )}
              {others.length > 0 && missing.length < others.length && (
                <button className="btn" onClick={() => setRecording(others)}>
                  ↺ {t('recordAllAgain')}
                </button>
              )}
            </>
          ) : (
            missing.length > 0 && (
              <button className="btn btn-primary" onClick={createAi}>
                ✨ {t('createAi')}
              </button>
            )
          )}
        </div>

        <div className="card flex flex-col gap-4 p-4">
          <label className="flex items-center gap-3 text-lg">
            <input type="checkbox" className="h-6 w-6 accent-amber-400" checked={memorize} onChange={(e) => setMemorize(e.target.checked)} />
            {t('memorize')}
          </label>
          <div className="flex items-center gap-3 text-lg">
            <span className="flex-1">{t('speed')}</span>
            <Select
              className="w-28"
              label={t('speed')}
              value={String(rate)}
              options={RATES.map((r) => ({ value: String(r), label: `‎×${r}` }))}
              onChange={(v) => setRate(Number(v))}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/s/${id}/settings`} className="btn flex-1">
            ⚙ {t('settings')}
          </Link>
          {script.original_name && (
            <a className="btn flex-1" target="_blank" rel="noreferrer" href={`/api/scripts/${id}/original`}>
              📄 {t('originalFile')}
            </a>
          )}
        </div>

        <p className="mt-2 text-dim">{t('tapLineToStart')}</p>
        <ol className="flex flex-col gap-2">
          {script.lines.map((l, i) => {
            const mine = l.character_id === script.my_character_id;
            return (
              <li key={l.id}>
                <button className={`card w-full p-3 text-start active:bg-card2 ${mine ? 'border-mine/50' : ''}`} onClick={() => play(i)}>
                  <span className={`font-bold ${mine ? 'text-mine' : 'text-other'}`}>{nameOf.get(l.character_id)}</span>
                  <span className="ms-2 text-sm text-dim" dir="ltr">
                    #{i + 1}
                  </span>
                  <span className="mt-1 block text-lg leading-snug" dir="auto">
                    {l.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <button className="btn btn-danger mt-4" onClick={remove}>
          🗑 {t('deleteScene')}
        </button>
      </Page>

      {progress && <Overlay title={t('recording')} done={progress[0]} total={progress[1]} />}
      {recording && (
        <Recorder
          script={script}
          lines={recording}
          onClose={(updates) => {
            setRecording(null);
            setScript((s) => (s ? { ...s, lines: s.lines.map((l) => ({ ...l, ...updates.get(l.id) })) } : s));
          }}
        />
      )}
      {playFrom !== null && (
        <Player
          script={script}
          from={playFrom}
          memorize={memorize}
          rate={rate}
          onExit={() => {
            setPlayFrom(null);
            load();
          }}
        />
      )}
    </>
  );
}

export default function Page_() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Scene />
    </Suspense>
  );
}
