'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api, clipUrl, getAudio, spokenOf } from '@/lib/client';
import { reduce, start, type Kind, type PlayerEvent, type PState } from '@/lib/player';
import { segments, wordsSpoken } from '@/lib/text';
import type { Line, Script } from '@/lib/types';

function LineText({ text, spoken, activeRef, plain }: { text: string; spoken: number; activeRef?: React.Ref<HTMLSpanElement>; plain?: boolean }) {
  const { segs } = useMemo(() => segments(text), [text]);
  return (
    <>
      {segs.map((s, i) =>
        s.dir ? (
          <span key={i} className="text-[0.7em] italic text-dim">
            {s.t}
          </span>
        ) : s.n < 0 ? (
          <span key={i} className={plain || spoken > 0 ? '' : 'opacity-60'}>{s.t}</span>
        ) : (
          <span
            key={i}
            ref={s.n === spoken - 1 ? activeRef : undefined}
            className={plain ? '' : s.n < spoken ? 'text-other transition-colors' : 'opacity-55 transition-colors'}
          >
            {s.t}
          </span>
        )
      )}
    </>
  );
}

export default function Player({
  script,
  from,
  memorize,
  rate,
  onExit,
}: {
  script: Script;
  from: number;
  memorize: boolean;
  rate: number;
  onExit: () => void;
}) {
  const { t } = useI18n();
  const lines = script.lines;
  const nameOf = useMemo(() => new Map(script.characters.map((c) => [c.id, c.name])), [script.characters]);
  const kinds = useMemo<Kind[]>(
    () => lines.map((l) => (l.character_id === script.my_character_id ? 'mine' : spokenOf(l) ? 'other' : 'silent')),
    [lines, script.my_character_id]
  );

  const [st, setSt] = useState<PState>(() => start(kinds, from));
  const [paused, setPaused] = useState(false);
  const [spoken, setSpoken] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const activeWord = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const dispatch = useCallback(
    (ev: PlayerEvent) => {
      setPaused(false);
      setSt((s) => reduce(kinds, s, ev));
    },
    [kinds]
  );

  // Drive audio / silent beats from the state machine.
  useEffect(() => {
    const a = getAudio();
    setSpoken(0);
    setRevealed(false);
    if (st.phase !== 'waiting') setFailed(false);
    stage.current?.scrollTo({ top: 0 });

    if (st.phase === 'pausing') {
      const timer = setTimeout(() => dispatch('ended'), 1200);
      return () => clearTimeout(timer);
    }
    if (st.phase !== 'speaking') return;

    const line = lines[st.idx];
    const count = segments(line.text).count;
    let cancelled = false;
    let raf = 0;
    const fail = () => {
      if (cancelled) return;
      setFailed(true);
      dispatch('fail');
    };
    const onEnded = () => !cancelled && dispatch('ended');
    const tick = () => {
      if (cancelled) return;
      setSpoken(wordsSpoken(line.timings, count, a.currentTime, a.duration));
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      try {
        if (!line.has_audio) throw new Error('no audio');
        const url = await clipUrl(line);
        if (cancelled) return;
        a.src = url;
        a.playbackRate = rate;
        a.addEventListener('ended', onEnded);
        a.addEventListener('error', fail);
        await a.play();
        raf = requestAnimationFrame(tick);
      } catch {
        fail();
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', fail);
      a.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.nonce]);

  // Pause / resume the current clip.
  useEffect(() => {
    if (st.phase !== 'speaking') return;
    const a = getAudio();
    if (paused) a.pause();
    else if (a.paused && a.currentTime > 0 && !a.ended) a.play().catch(() => {});
  }, [paused, st.phase]);

  // Preload upcoming clips, remember position.
  useEffect(() => {
    let n = 0;
    for (let i = st.idx + 1; i < lines.length && n < 2; i++) {
      if (kinds[i] === 'other' && lines[i].has_audio) {
        clipUrl(lines[i]).catch(() => {});
        n++;
      }
    }
    api(`/scripts/${script.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_line_idx: st.phase === 'done' ? 0 : st.idx }),
    }).catch(() => {});
  }, [st.idx, st.phase, kinds, lines, script.id]);

  // Keep the screen awake while rehearsing.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = () =>
      (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock
        ?.request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  const tap = useCallback(() => {
    if (st.phase === 'done') return;
    if (paused) setPaused(false);
    else dispatch('tap');
  }, [st.phase, paused, dispatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tap();
      } else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap, onExit]);

  // Keep the word being spoken in view during long speeches.
  useEffect(() => {
    activeWord.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [spoken]);

  const done = st.phase === 'done';
  const line: Line | undefined = lines[st.idx];
  const mine = !done && kinds[st.idx] === 'mine';
  const hidden = mine && memorize && !revealed;
  const upcoming = done ? [] : lines.slice(st.idx + 1, st.idx + 4);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const hint = done
    ? ''
    : paused
      ? t('paused')
      : mine
        ? `${t('tapWhenDone')} (${t('tapWhenDoneKb')})`
        : failed
          ? t('noRecording')
          : t('tapToSkip');

  return (
    <div className="fixed inset-0 z-40 flex select-none flex-col bg-bg" onClick={tap} data-phase={st.phase} data-idx={st.idx}>
      <div className="h-1.5 bg-card2">
        <div className="h-full bg-mine transition-all" style={{ width: `${(Math.min(st.idx, lines.length) / lines.length) * 100}%` }} />
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <p className="text-4xl font-bold">{t('theEnd')}</p>
          <button className="btn btn-primary w-full max-w-xs text-xl" onClick={stop(() => setSt((s) => ({ ...start(kinds, 0), nonce: s.nonce + 1 })))}>
            ↻ {t('again')}
          </button>
          <button className="btn w-full max-w-xs text-xl" onClick={stop(onExit)}>
            {t('exit')}
          </button>
        </div>
      ) : (
        <div ref={stage} className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
          <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-4">
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-4 py-1 text-xl font-bold ${mine ? 'bg-mine text-black' : 'bg-card2 text-other'}`}>
                {mine ? `${t('yourTurn')} · ${nameOf.get(line!.character_id)}` : nameOf.get(line!.character_id)}
              </span>
              <span className="text-dim" dir="ltr">
                {st.idx + 1}/{lines.length}
              </span>
            </div>
            <p
              dir="auto"
              aria-live="polite"
              className={`text-[2rem] font-semibold leading-[1.45] sm:text-[2.5rem] ${mine ? 'text-mine' : 'text-ink'}`}
            >
              {hidden ? (
                <>
                  {spokenOf(line!).split(' ')[0]} …{' '}
                  <button className="btn ms-2 align-middle text-base" onClick={stop(() => setRevealed(true))}>
                    👁 {t('show')}
                  </button>
                </>
              ) : mine || st.phase === 'waiting' ? (
                <LineText text={line!.text} spoken={0} plain />
              ) : (
                <LineText text={line!.text} spoken={spoken} activeRef={activeWord} />
              )}
            </p>
            {upcoming.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                <p className="text-sm text-dim">{t('upNext')}</p>
                {upcoming.map((l) => {
                  const m = l.character_id === script.my_character_id;
                  return (
                    <p key={l.id} dir="auto" className="text-lg leading-snug text-dim">
                      <b className={m ? 'text-mine/80' : 'text-other/80'}>{nameOf.get(l.character_id)}: </b>
                      {m && memorize ? '…' : l.text}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!done && (
        <div className="border-t border-line bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <p className={`pb-2 text-center text-lg ${mine && !paused ? 'font-semibold text-mine' : 'text-dim'}`}>{hint}</p>
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2">
            {(
              [
                ['✕', t('exit'), onExit, false],
                ['⏮', t('prevLine'), () => dispatch('back'), st.idx === 0],
                ['↺', t('replayCue'), () => dispatch('cue'), false],
                [paused ? '▶' : '⏸', paused ? t('resume') : t('pause'), () => setPaused((p) => !p), st.phase !== 'speaking'],
              ] as [string, string, () => void, boolean][]
            ).map(([icon, label, fn, disabled], i) => (
              <button key={i} className="btn min-h-16 flex-col gap-0 px-1 text-base" onClick={stop(fn)} disabled={disabled}>
                <span className="text-xl leading-none" aria-hidden>{icon}</span>
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
