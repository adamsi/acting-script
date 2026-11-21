'use client';
import { spokenText } from './text';
import type { Draft, DraftCharacter, Gender, Line, Script, Voice } from './types';

// ---------- API ----------

/** Calls the app's API. The signed-in user is identified by Clerk's session cookie. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { code: body.code, status: res.status });
  }
  return res;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request(path, init)).json();
}
export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  return (await request(path, init)).blob();
}

// ---------- audio ----------

const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let audioEl: HTMLAudioElement | null = null;

/** One shared element: once unlocked by a tap it can keep playing clips without further gestures (iOS). */
export function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
  }
  return audioEl;
}

/** Call synchronously inside a click/tap handler before any async work. */
export function unlockAudio() {
  const a = getAudio();
  a.src = SILENCE;
  a.play().catch(() => {});
}

const clipUrls = new Map<string, Promise<string>>();

export function clipUrl(line: Pick<Line, 'id' | 'hash'>): Promise<string> {
  const key = `${line.id}:${line.hash}`;
  let p = clipUrls.get(key);
  if (!p) {
    p = apiBlob(`/lines/${line.id}/audio`).then((b) => URL.createObjectURL(b));
    p.catch(() => clipUrls.delete(key));
    clipUrls.set(key, p);
  }
  return p;
}
export function forgetClip(line: Pick<Line, 'id' | 'hash'>) {
  clipUrls.delete(`${line.id}:${line.hash}`);
}

export async function playBlob(blob: Blob) {
  const a = getAudio();
  a.playbackRate = 1;
  a.src = URL.createObjectURL(blob);
  await a.play();
}

export const spokenOf = (l: { text: string; spoken_text: string }) =>
  (l.spoken_text || '').trim() || spokenText(l.text);

/**
 * Creates every missing / outdated recording for the lines the app has to speak.
 * Returns the script with updated line status and the number of failures.
 */
export async function ensureAudio(
  script: Script,
  opts: { force?: boolean; improve?: boolean; lineIds?: string[]; allCharacters?: boolean },
  onProgress?: (done: number, total: number) => void
): Promise<{ script: Script; failed: number; fixed: number; error: string }> {
  const only = opts.lineIds ? new Set(opts.lineIds) : null;
  const todo = script.lines.filter((l) => {
    if (only && !only.has(l.id)) return false;
    if (!only && !opts.allCharacters && l.character_id === script.my_character_id) return false;
    if (!spokenOf(l)) return false;
    return opts.force || !l.fresh || (!!opts.improve && !l.improved);
  });
  const updates = new Map<string, Partial<Line>>();
  let done = 0;
  let failed = 0;
  let fixed = 0;
  let error = '';
  onProgress?.(0, todo.length);
  const queue = [...todo];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      try {
        const { fixes, ...r } = await api<Partial<Line> & { fixes?: unknown[] }>(`/lines/${l.id}/audio`, {
          method: 'POST',
          body: JSON.stringify({ force: !!opts.force, improve: !!opts.improve }),
        });
        fixed += fixes?.length || 0;
        forgetClip(l);
        updates.set(l.id, r);
      } catch (e) {
        failed++;
        error ||= e instanceof Error ? e.message : String(e);
      }
      onProgress?.(++done, todo.length);
    }
  };
  // Pronunciation checks are slow, so more of them run side by side.
  await Promise.all(Array.from({ length: opts.improve ? 6 : 3 }, worker));
  return {
    script: { ...script, lines: script.lines.map((l) => ({ ...l, ...updates.get(l.id) })) },
    failed,
    fixed,
    error,
  };
}

// ---------- drafts ----------

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${seq++}`;

export function pickVoice(gender: Gender, voices: Voice[], used: Set<string>): string {
  const match = voices.filter((v) => gender === 'unknown' || v.gender === gender);
  const pool = match.length ? match : voices;
  const v = pool.find((x) => !used.has(x.id)) || pool[0];
  return v?.id || '';
}

export function draftFromParsed(
  p: {
    title: string;
    author: string;
    language: 'he' | 'en';
    characters: { name: string; gender: Gender; description: string }[];
    lines: { speaker: string; text: string }[];
  },
  voices: Voice[]
): Draft {
  const used = new Set<string>();
  const characters: DraftCharacter[] = p.characters.map((c) => {
    const voice_id = pickVoice(c.gender, voices, used);
    used.add(voice_id);
    return { key: newKey(), name: c.name, gender: c.gender, description: c.description, voice_id };
  });
  const byName = new Map(characters.map((c) => [c.name, c.key]));
  return {
    title: p.title,
    author: p.author,
    language: p.language,
    characters,
    lines: p.lines.map((l) => ({
      key: newKey(),
      speaker: byName.get(l.speaker) || characters[0]?.key || '',
      text: l.text,
      spoken_text: '',
    })),
    my: '',
  };
}

export function draftFromScript(s: Script): Draft {
  return {
    title: s.title,
    author: s.author,
    language: s.language,
    characters: s.characters.map((c) => ({ ...c, key: c.id })),
    lines: s.lines.map((l) => ({
      key: l.id,
      id: l.id,
      speaker: l.character_id,
      text: l.text,
      spoken_text: l.spoken_text,
    })),
    my: s.my_character_id || '',
  };
}
