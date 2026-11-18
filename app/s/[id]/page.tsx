'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ensureAudio, getPasskey, unlockAudio } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { Script } from '@/lib/types';
import Player from '@/components/Player';
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

export default function Scene() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [script, setScript] = useState<Script | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  const [warn, setWarn] = useState('');
  const [memorize, setMemorize] = usePref('memorize', false);
  const [rate, setRate] = usePref('rate', 1);

  const load = useCallback(() => {
    setError('');
    api<Script>(`/scripts/${id}`).then(setScript, (e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const nameOf = useMemo(() => new Map(script?.characters.map((c) => [c.id, c.name])), [script]);

  async function play(from: number) {
    if (!script?.my_character_id) return;
    unlockAudio(); // must happen inside the tap, before any await
    setWarn('');
    let current = script;
    const needs = script.lines.some((l) => l.character_id !== script.my_character_id && !l.fresh);
    if (needs) {
      setProgress([0, 0]);
      const r = await ensureAudio(script, {}, (d, n) => setProgress([d, n]));
      current = r.script;
      setScript(current);
      setProgress(null);
      if (r.failed) setWarn(t('recordingFailed'));
    }
    setPlayFrom(Math.min(from, current.lines.length - 1));
  }

  async function setMe(characterId: string) {
    if (!script) return;
    setScript({ ...script, my_character_id: characterId });
    await api(`/scripts/${id}`, { method: 'PATCH', body: JSON.stringify({ my_character_id: characterId }) }).catch(() => {});
  }

  if (!script) return <><TopBar title="" back="/" /><Status error={error} onRetry={load} /></>;

  const resumeAt = script.last_line_idx > 0 && script.last_line_idx < script.lines.length ? script.last_line_idx : 0;

  return (
    <>
      <TopBar title={script.title} back="/" />
      <Page>
        {script.author && <p className="text-dim" dir="auto">{script.author}</p>}

        <label className="card flex items-center gap-3 p-4">
          <span className="text-xl font-semibold">{t('iAm')}</span>
          <select className="field flex-1 text-xl font-bold text-mine" value={script.my_character_id || ''} onChange={(e) => setMe(e.target.value)}>
            {!script.my_character_id && <option value="">—</option>}
            {script.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <button className="btn btn-primary min-h-20 text-3xl" disabled={!script.my_character_id || !script.lines.length} onClick={() => play(0)}>
          ▶ {t('play')}
        </button>
        {resumeAt > 0 && (
          <button className="btn text-xl" onClick={() => play(resumeAt)}>
            {t('continueFrom')} {resumeAt + 1}
          </button>
        )}
        {warn && <p className="text-red-300">{warn}</p>}

        <div className="card flex flex-col gap-4 p-4">
          <label className="flex items-center gap-3 text-lg">
            <input type="checkbox" className="h-6 w-6 accent-amber-400" checked={memorize} onChange={(e) => setMemorize(e.target.checked)} />
            {t('memorize')}
          </label>
          <label className="flex items-center gap-3 text-lg">
            <span className="flex-1">{t('speed')}</span>
            <select className="field w-auto" dir="ltr" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              {RATES.map((r) => (
                <option key={r} value={r}>
                  ×{r}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <Link href={`/s/${id}/settings`} className="btn flex-1">
            ⚙ {t('settings')}
          </Link>
          {script.original_name && (
            <a className="btn flex-1" target="_blank" rel="noreferrer" href={`/api/scripts/${id}/original?passkey=${encodeURIComponent(getPasskey())}`}>
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
                  <span className="ms-2 text-sm text-dim" dir="ltr">#{i + 1}</span>
                  <span className="mt-1 block text-lg leading-snug" dir="auto">
                    {l.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Page>

      {progress && <Overlay title={t('recording')} done={progress[0]} total={progress[1]} />}
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
