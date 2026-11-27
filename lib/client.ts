'use client';
import { useEffect, useState } from 'react';
import { segments, spokenText } from './text';
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

/** Switches set in the admin panel, and whether this account is an admin. null while loading. */
export interface AppConfig {
  aiVoices: boolean;
  admin: boolean;
}
export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);
  useEffect(() => {
    api<AppConfig>('/config').then(setConfig, () => setConfig({ aiVoices: true, admin: false }));
  }, []);
  return config;
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
    // The hash names this exact recording, so the browser may keep it and skip the download next time.
    p = apiBlob(`/lines/${line.id}/audio?h=${line.hash}`).then((b) => URL.createObjectURL(b));
    p.catch(() => clipUrls.delete(key));
    clipUrls.set(key, p);
  }
  return p;
}
/**
 * Downloads the first recordings the rehearsal will need, starting at line `from`, so that Play
 * starts speaking at once instead of after the download.
 */
export function preloadClips(script: Script, from = 0, count = 3) {
  let n = 0;
  for (let i = Math.max(0, from); i < script.lines.length && n < count; i++) {
    const l = script.lines[i];
    if (l.character_id === script.my_character_id || !l.has_audio) continue;
    clipUrl(l).catch(() => {});
    n++;
  }
}

/** Where to start playing a recording: AI voices begin with a pause, which is skipped. */
export function clipStart(line: Pick<Line, 'timings' | 'source'>): number {
  const first = line.source === 'ai' ? line.timings?.[0]?.[0] : undefined;
  return typeof first === 'number' && first > 0.15 ? Math.max(0, first - 0.08) : 0;
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
 * Creates every missing / outdated AI recording for the lines the app has to speak.
 * Returns the script with updated line status and the number of failures.
 */
export async function ensureAudio(
  script: Script,
  opts: { force?: boolean; lineIds?: string[]; allCharacters?: boolean },
  onProgress?: (done: number, total: number) => void
): Promise<{ script: Script; failed: number; error: string }> {
  const only = opts.lineIds ? new Set(opts.lineIds) : null;
  const todo = script.lines.filter((l) => {
    if (only && !only.has(l.id)) return false;
    if (!only && !opts.allCharacters && l.character_id === script.my_character_id) return false;
    if (!spokenOf(l)) return false;
    return opts.force || !l.fresh;
  });
  const updates = new Map<string, Partial<Line>>();
  let done = 0;
  let failed = 0;
  let error = '';
  onProgress?.(0, todo.length);
  const queue = [...todo];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      try {
        const r = await api<Partial<Line>>(`/lines/${l.id}/audio`, { method: 'POST', body: JSON.stringify({ force: !!opts.force }) });
        forgetClip(l);
        updates.set(l.id, r);
      } catch (e) {
        failed++;
        error ||= e instanceof Error ? e.message : String(e);
      }
      onProgress?.(++done, todo.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return {
    script: { ...script, lines: script.lines.map((l) => ({ ...l, ...updates.get(l.id) })) },
    failed,
    error,
  };
}

/** The lines the app speaks that have no up-to-date recording. */
export function linesToRecord(script: Script): Line[] {
  if (!script.my_character_id) return [];
  return script.lines.filter((l) => l.character_id !== script.my_character_id && !l.fresh && !!spokenOf(l));
}

/**
 * Word timings for a recording the user made: the words are spread over its length in proportion
 * to their size, so the text can still be highlighted while it plays.
 */
export function proportionalTimings(text: string, seconds: number): number[][] {
  const words = segments(text).segs.filter((s) => s.n >= 0).map((s) => s.t.length);
  const total = words.reduce((a, b) => a + b, 0);
  if (!total || !(seconds > 0)) return [];
  let at = 0;
  return words.map((w) => {
    const start = (at / total) * seconds;
    at += w;
    return [Number(start.toFixed(3)), Number(((at / total) * seconds).toFixed(3))];
  });
}

/** Saves a recording the user made of one line with their own voice. */
export async function uploadOwnRecording(line: Line, blob: Blob, seconds: number): Promise<Partial<Line>> {
  const form = new FormData();
  // an uploaded file keeps its name (the server reads the type from it when the browser gives none)
  form.append('file', blob instanceof File ? blob : new File([blob], 'line', { type: blob.type || 'audio/webm' }));
  form.append('timings', JSON.stringify(proportionalTimings(line.text, seconds)));
  const r = await api<Partial<Line>>(`/lines/${line.id}/audio`, { method: 'PUT', body: form });
  forgetClip(line);
  return r;
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
