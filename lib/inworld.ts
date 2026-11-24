import { createHash } from 'crypto';
import { hasLetters } from './text';
import { normalizeHebrew } from './pronounce';
import type { Gender, Voice } from './types';

const BASE = 'https://api.inworld.ai';
export const TTS_MODEL = process.env.INWORLD_MODEL || 'inworld-tts-1.5-max';
const MAX_CHARS = 1800;

function headers() {
  const key = process.env.INWORLD_API_KEY;
  if (!key) throw new Error('INWORLD_API_KEY is not configured');
  return { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' };
}

/** Identifies a recording: changes whenever the spoken text, voice or model changes. */
/** Identifies a recording the user made of this text (it does not depend on a voice). */
export function ownAudioHash(spoken: string): string {
  return createHash('sha1').update(`own|${spoken}`).digest('hex');
}

export function audioHash(spoken: string, voiceId: string): string {
  return createHash('sha1').update(`v2|${TTS_MODEL}|${voiceId}|${spoken}`).digest('hex');
}

let voiceCache: { at: number; voices: Voice[] } | null = null;

export async function listVoices(): Promise<Voice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60_000) return voiceCache.voices;
  const res = await fetch(`${BASE}/voices/v1/voices`, { headers: headers() });
  if (!res.ok) throw new Error(`Inworld voices failed (${res.status})`);
  const data = (await res.json()) as { voices: Record<string, string>[] };
  const voices: Voice[] = data.voices.map((v) => ({
    id: v.voiceId,
    name: v.displayName || v.voiceId,
    gender: (v.gender === 'male' || v.gender === 'female' ? v.gender : 'unknown') as Gender,
    lang: (v.languageCode || v.langCode || '').toLowerCase().replace('_', '-'),
    description: v.description || '',
  }));
  voiceCache = { at: Date.now(), voices };
  return voices;
}

function chunks(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const out: string[] = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?…])\s+/)) {
    if (cur && cur.length + s.length + 1 > MAX_CHARS) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
    while (cur.length > MAX_CHARS) {
      out.push(cur.slice(0, MAX_CHARS));
      cur = cur.slice(MAX_CHARS);
    }
  }
  if (cur) out.push(cur);
  return out;
}

export interface Synth {
  audio: Buffer;
  /** [start, end] seconds for every spoken word, in order */
  timings: number[][];
}

async function synthOne(text: string, voiceId: string): Promise<Synth & { end: number }> {
  const res = await fetch(`${BASE}/tts/v1/voice`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      text,
      voiceId,
      modelId: TTS_MODEL,
      timestampType: 'WORD',
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Inworld TTS failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const wa = data.timestampInfo?.wordAlignment;
  const timings: number[][] = [];
  let end = 0;
  if (wa?.words) {
    wa.words.forEach((w: string, i: number) => {
      end = Math.max(end, wa.wordEndTimeSeconds[i] ?? 0);
      if (hasLetters(w)) timings.push([wa.wordStartTimeSeconds[i], wa.wordEndTimeSeconds[i]]);
    });
  }
  return { audio: Buffer.from(data.audioContent, 'base64'), timings, end };
}

/** Speaks `text` with an Inworld voice. */
export async function synthesize(text: string, voiceId: string): Promise<Synth> {
  const parts: Buffer[] = [];
  const timings: number[][] = [];
  let offset = 0;
  for (const c of chunks(normalizeHebrew(text))) {
    const r = await synthOne(c, voiceId);
    parts.push(r.audio);
    for (const [s, e] of r.timings) timings.push([s + offset, e + offset]);
    offset += r.end;
  }
  return { audio: Buffer.concat(parts), timings };
}
