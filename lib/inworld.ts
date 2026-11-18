import { createHash } from 'crypto';
import { hasLetters } from './text';
import { applyFixes, findFixes, normalizeHebrew, PRONUNCIATION_FIX, type Fix, type SpokenToken } from './pronounce';
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
  /** words whose pronunciation was corrected automatically */
  fixes: Fix[];
  /** the pronunciation check ran for the whole text */
  checked: boolean;
}

interface Chunk {
  audio: Buffer;
  timings: number[][];
  end: number;
  tokens: SpokenToken[];
}

async function synthOne(text: string, voiceId: string): Promise<Chunk> {
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
  const tokens: SpokenToken[] = [];
  let end = 0;
  if (wa?.words) {
    const phones = new Map<number, string>();
    for (const p of wa.phoneticDetails ?? [])
      phones.set(p.wordIndex, (p.phones ?? []).map((x: { phoneSymbol: string }) => x.phoneSymbol).join(''));
    wa.words.forEach((w: string, i: number) => {
      end = Math.max(end, wa.wordEndTimeSeconds[i] ?? 0);
      tokens.push({ text: w, phones: (phones.get(i) || '').replace(/\[[^\]]*\]/g, '') });
      if (hasLetters(w)) timings.push([wa.wordStartTimeSeconds[i], wa.wordEndTimeSeconds[i]]);
    });
  }
  return { audio: Buffer.from(data.audioContent, 'base64'), timings, end, tokens };
}

/**
 * Speaks `text`. With `context` (Hebrew lines), the engine's phonemes are checked by a language
 * model and mispronounced words are re-spoken from corrected IPA.
 */
export async function synthesize(text: string, voiceId: string, context?: string): Promise<Synth> {
  const parts: Buffer[] = [];
  const timings: number[][] = [];
  const fixes: Fix[] = [];
  let checked = !!context && PRONUNCIATION_FIX;
  let offset = 0;
  for (const c of chunks(normalizeHebrew(text))) {
    let r = await synthOne(c, voiceId);
    if (context && PRONUNCIATION_FIX && /[\u0590-\u05FF]/.test(c)) {
      const found = await findFixes(r.tokens, context);
      // The rebuilt text only lines up if the engine's tokens reproduce the input exactly.
      if (!found) checked = false;
      else if (found.length && r.tokens.map((t) => t.text).join('') === c) {
        const fixed = await synthOne(applyFixes(r.tokens, found), voiceId).catch(() => null);
        if (fixed && fixed.timings.length === r.timings.length) {
          r = fixed;
          fixes.push(...found);
        }
      }
    }
    parts.push(r.audio);
    for (const [s, e] of r.timings) timings.push([s + offset, e + offset]);
    offset += r.end;
  }
  return { audio: Buffer.concat(parts), timings, fixes, checked };
}
