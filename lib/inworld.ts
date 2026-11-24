import { createHash } from 'crypto';
import { hasLetters } from './text';
import { normalizeHebrew } from './pronounce';
import type { Gender, Voice } from './types';

const BASE = 'https://api.inworld.ai';
/** Inworld's current flagship model. The 1.5 models that were used before are deprecated. */
export const TTS_MODEL = process.env.INWORLD_MODEL || 'inworld-tts-2';
/** Models recordings may have been made with before; those recordings stay valid. */
const EARLIER_MODELS = ['inworld-tts-1.5-max', 'inworld-tts-1.5-mini'];
const MAX_CHARS = 1800;

/** `apiKey`: a personal key for this request; otherwise the shared INWORLD_API_KEY is used. */
function headers(apiKey?: string) {
  const key = apiKey || process.env.INWORLD_API_KEY;
  if (!key) throw new Error('INWORLD_API_KEY is not configured');
  return { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' };
}

/** Identifies a recording the user made of this text (it does not depend on a voice). */
export function ownAudioHash(spoken: string): string {
  return createHash('sha1').update(`own|${spoken}`).digest('hex');
}

/** Identifies an AI recording: changes whenever the spoken text, voice or model changes. */
export function audioHash(spoken: string, voiceId: string, model = TTS_MODEL): string {
  return createHash('sha1').update(`v2|${model}|${voiceId}|${spoken}`).digest('hex');
}

/**
 * Is a stored AI recording still the recording of this text and voice? True also for recordings
 * made with an earlier model, so changing the model does not make every scene need re-recording.
 */
export function isCurrentAiRecording(storedHash: string | null, spoken: string, voiceId: string): boolean {
  if (!storedHash) return false;
  return [TTS_MODEL, ...EARLIER_MODELS].some((m) => audioHash(spoken, voiceId, m) === storedHash);
}

let voiceCache: { at: number; voices: Voice[] } | null = null;

export async function listVoices(apiKey?: string): Promise<Voice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60_000) return voiceCache.voices;
  const res = await fetch(`${BASE}/voices/v1/voices`, { headers: headers(apiKey) });
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

/** A whole text: also how many characters were sent to Inworld (what it bills by). */
export interface SynthResult extends Synth {
  characters: number;
}

async function synthOne(text: string, voiceId: string, apiKey?: string): Promise<Synth & { end: number }> {
  const res = await fetch(`${BASE}/tts/v1/voice`, {
    method: 'POST',
    headers: headers(apiKey),
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

/** Speaks `text` with an Inworld voice. `apiKey`: a personal key to use (and bill) instead of the shared one. */
export async function synthesize(text: string, voiceId: string, apiKey?: string): Promise<SynthResult> {
  const parts: Buffer[] = [];
  const timings: number[][] = [];
  let offset = 0;
  let characters = 0;
  for (const c of chunks(normalizeHebrew(text))) {
    const r = await synthOne(c, voiceId, apiKey);
    characters += c.length;
    parts.push(r.audio);
    for (const [s, e] of r.timings) timings.push([s + offset, e + offset]);
    offset += r.end;
  }
  return { audio: Buffer.concat(parts), timings, characters };
}
