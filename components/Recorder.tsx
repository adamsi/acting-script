'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { errorText, useI18n } from '@/lib/i18n';
import { uploadOwnRecording } from '@/lib/client';
import { segments } from '@/lib/text';
import type { Line, Script } from '@/lib/types';

type Phase = 'idle' | 'recording' | 'recorded' | 'saving';

/** Longest single recording; it stops by itself after that. */
const MAX_SECONDS = 180;
/** Largest audio file that can be uploaded for one line (the hosting limits a request to about 4.5MB). */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
}

/**
 * Full-screen recorder: the user reads the other characters' lines aloud, one after the other.
 * Every saved recording is stored right away, so leaving in the middle loses nothing.
 */
export default function Recorder({ script, lines, onClose }: { script: Script; lines: Line[]; onClose: (updates: Map<string, Partial<Line>>) => void }) {
  const { t } = useI18n();
  const nameOf = useMemo(() => new Map(script.characters.map((c) => [c.id, c.name])), [script.characters]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [take, setTake] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const updates = useRef(new Map<string, Partial<Line>>());
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);

  const line = lines[i];
  const done = i >= lines.length;

  // Release the microphone when the recorder closes.
  useEffect(
    () => () => {
      recorder.current?.state === 'recording' && recorder.current.stop();
      stream.current?.getTracks().forEach((tr) => tr.stop());
    },
    []
  );
  useEffect(() => () => void (take && URL.revokeObjectURL(take.url)), [take]);

  // Timer while recording, with an automatic stop.
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      const s = (performance.now() - startedAt.current) / 1000;
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function start() {
    setError('');
    player.current?.pause();
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return setError(t('recUnsupported'));
    try {
      stream.current ??= await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError(t('recMicDenied'));
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const length = (performance.now() - startedAt.current) / 1000;
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
      setTake({ blob, url: URL.createObjectURL(blob), seconds: length });
      setPhase('recorded');
    };
    recorder.current = rec;
    startedAt.current = performance.now();
    setSeconds(0);
    setTake(null);
    rec.start();
    setPhase('recording');
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  /** An audio file from the device instead of a new recording: it becomes the take, to listen to and save. */
  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    player.current?.pause();
    if (file.size > MAX_UPLOAD_BYTES) return setError(t('recUploadTooBig'));
    const url = URL.createObjectURL(file);
    const length = await new Promise<number>((resolve) => {
      const a = new Audio();
      const finish = (n: number) => resolve(isFinite(n) && n > 0 ? n : 0);
      a.preload = 'metadata';
      a.onloadedmetadata = () => finish(a.duration);
      a.onerror = () => finish(0);
      setTimeout(() => finish(a.duration), 4000);
      a.src = url;
    });
    if (!length) {
      URL.revokeObjectURL(url);
      return setError(t('recUploadBad'));
    }
    setTake({ blob: file, url, seconds: length });
    setPhase('recorded');
  }

  function listen() {
    if (!take) return;
    player.current ??= new Audio();
    player.current.src = take.url;
    player.current.play().catch(() => {});
  }

  function next() {
    player.current?.pause();
    setTake(null);
    setPhase('idle');
    setError('');
    setI((n) => n + 1);
  }

  async function save() {
    if (!take || !line) return;
    setPhase('saving');
    setError('');
    try {
      updates.current.set(line.id, await uploadOwnRecording(line, take.blob, take.seconds));
      next();
    } catch (e) {
      setError(errorText(e, t));
      setPhase('recorded');
    }
  }

  const close = () => onClose(updates.current);
  const clock = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg" role="dialog" aria-label={t('recTitle')}>
      <div className="h-1.5 bg-card2">
        <div className="h-full bg-mine transition-all" style={{ width: `${(Math.min(i, lines.length) / Math.max(1, lines.length)) * 100}%` }} />
      </div>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold">{t('recTitle')}</h2>
        {!done && (
          <span className="text-dim" dir="ltr">
            {i + 1}/{lines.length}
          </span>
        )}
        <button className="btn min-h-11 px-3" onClick={close}>
          ✕ {t('exit')}
        </button>
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-other/15 text-4xl text-other" aria-hidden>
            ✓
          </span>
          <p className="text-3xl font-bold">{lines.length ? t('recDone') : t('recNothing')}</p>
          <button className="btn btn-primary w-full max-w-xs text-xl" onClick={close}>
            {t('next')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <span className="self-start rounded-full bg-card2 px-4 py-1 text-xl font-bold text-other">{nameOf.get(line.character_id)}</span>
              <p dir="auto" className="text-[1.8rem] font-semibold leading-[1.45]">
                {segments(line.text).segs.map((s, k) =>
                  s.dir ? (
                    <span key={k} className="text-[0.7em] italic text-dim">
                      {s.t}
                    </span>
                  ) : (
                    <span key={k}>{s.t}</span>
                  )
                )}
              </p>
              <p className="text-dim">{t('recHint')}</p>
              {error && (
                <p className="card border-red-400/50 p-4 text-red-300" role="alert" dir="auto">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-line bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
              {phase === 'idle' && (
                <>
                  <button className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/40 active:scale-95" onClick={start} aria-label={t('recStart')}>
                    <span className="h-8 w-8 rounded-full bg-white" />
                  </button>
                  <span className="text-lg font-semibold">{t('recStart')}</span>
                  <div className="flex w-full gap-2">
                    <label className="btn flex-1 cursor-pointer whitespace-nowrap px-2">
                      ⬆ {t('recUpload')}
                      <input
                        type="file"
                        className="sr-only"
                        accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.webm"
                        onChange={(e) => {
                          upload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button className="btn flex-1" onClick={next}>
                      {t('recSkip')}
                    </button>
                  </div>
                </>
              )}
              {phase === 'recording' && (
                <>
                  <button className="flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/40" onClick={stop} aria-label={t('recStop')}>
                    <span className="h-8 w-8 rounded-md bg-white" />
                  </button>
                  <span className="text-lg font-semibold tabular-nums" dir="ltr" role="timer">
                    ● {clock}
                  </span>
                  <span className="text-dim">{t('recStop')}</span>
                </>
              )}
              {(phase === 'recorded' || phase === 'saving') && (
                <>
                  <button className="btn btn-primary w-full text-xl" disabled={phase === 'saving'} onClick={save}>
                    {phase === 'saving' ? t('recSaving') : `✓ ${t('recSaveNext')}`}
                  </button>
                  <div className="flex w-full gap-2">
                    <button className="btn flex-1" disabled={phase === 'saving'} onClick={listen}>
                      ▶ {t('recListen')}
                    </button>
                    <button className="btn flex-1" disabled={phase === 'saving'} onClick={start}>
                      ↺ {t('recAgain')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
