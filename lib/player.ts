// Pure rehearsal state machine. The UI plays audio / waits for taps according to `phase`.

/** mine: the actor speaks it. other: the app speaks it. silent: nothing to speak (only a stage direction). */
export type Kind = 'mine' | 'other' | 'silent';
/** speaking: app audio is playing. waiting: waiting for the actor's tap. pausing: short silent beat. */
export type Phase = 'speaking' | 'waiting' | 'pausing' | 'done';
export type PlayerEvent = 'tap' | 'ended' | 'fail' | 'back' | 'cue';

export interface PState {
  idx: number;
  phase: Phase;
  /** bumps on every transition so effects re-run even when idx is unchanged (replay) */
  nonce: number;
}

function at(kinds: Kind[], idx: number, nonce: number): PState {
  if (idx >= kinds.length) return { idx: kinds.length, phase: 'done', nonce };
  const i = Math.max(0, idx);
  const k = kinds[i];
  return { idx: i, phase: k === 'mine' ? 'waiting' : k === 'other' ? 'speaking' : 'pausing', nonce };
}

export function start(kinds: Kind[], from = 0): PState {
  return at(kinds, from, 1);
}

export function reduce(kinds: Kind[], s: PState, ev: PlayerEvent): PState {
  const n = s.nonce + 1;
  switch (ev) {
    case 'tap':
      // On my line: "I finished". On another character's line: skip it.
      return s.phase === 'done' ? s : at(kinds, s.idx + 1, n);
    case 'ended':
      // Audio / silent beat finished. Never auto-advances past the actor's own line.
      return s.phase === 'speaking' || s.phase === 'pausing' ? at(kinds, s.idx + 1, n) : s;
    case 'fail':
      // Audio could not play: show the text and wait for a tap instead of getting stuck.
      return s.phase === 'speaking' ? { ...s, phase: 'waiting', nonce: n } : s;
    case 'back':
      return at(kinds, s.idx - 1, n);
    case 'cue': {
      // Replay the last line spoken by the app (the actor's cue).
      let i = s.phase === 'speaking' ? s.idx : s.idx - 1;
      while (i >= 0 && kinds[i] !== 'other') i--;
      return i < 0 ? s : at(kinds, i, n);
    }
  }
}
