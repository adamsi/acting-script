import { hasLetters } from './text';

/** One token of the synthesized text with the phonemes the TTS engine actually spoke. */
export interface SpokenToken {
  text: string;
  phones: string;
}
export interface Fix {
  index: number;
  word: string;
  ipa: string;
}

/**
 * Pronunciation check. Kept on gpt-5.4 by default: on a 3-page scene gpt-5.4-mini cost about half but
 * missed 10 of the 24 corrections and got two verb stresses wrong; nano invented corrections.
 */
const MODEL = process.env.PRONUNCIATION_MODEL || 'gpt-5.4';
export const PRONUNCIATION_FIX = process.env.PRONUNCIATION_FIX !== 'off';

const HEB = '֐-׿';

/**
 * Typography the engine needs: an ASCII apostrophe after a Hebrew letter is read as the
 * letter's name ("ג'סי" → "gimel-si"), the Hebrew geresh/gershayim are read correctly.
 */
export function normalizeHebrew(text: string): string {
  return text
    .replace(new RegExp(`([${HEB}])['’‘](?=[${HEB}])`, 'g'), '$1׳')
    .replace(new RegExp(`([${HEB}])["”“](?=[${HEB}])`, 'g'), '$1״');
}

const INSTRUCTIONS = `You are an expert in Modern Israeli Hebrew pronunciation, checking a text-to-speech engine.

You get one line of dialogue from a play (with context) and, for each word, the phonemes the engine spoke.
Unvocalized Hebrew is ambiguous and the engine often guesses wrong. Return ONLY the words it pronounced incorrectly, each with the correct pronunciation in the engine's own phoneme notation.

Report a word when the engine's phonemes are wrong for natural, everyday Israeli speech in this context, e.g.:
- wrong vowels or the wrong reading of a homograph (ספר: sˈefer / sapˈar / sipˈer / safˈar)
- wrong grammatical form: person/gender suffix (אותך: otxˈa to a man, otˈax to a woman; טיפלת: tipˈalta to a man, tipˈalt to a woman), construct state (זיוני שכל: zijunˈej sˈexel), verb vs noun
- missing or garbled sounds, letter names read aloud, misread names, loanwords, abbreviations and numbers
- stress on the wrong syllable when it is clearly wrong (harˈaɡti, not haraɡtˈi)

Be conservative: a wrong correction is worse than a missed one. Before reporting a word, work out its correct reading from the grammar of the whole sentence (subject gender and number, tense, definiteness, construct state) and compare it sound by sound with what the engine spoke. Do NOT report words that are already acceptable, including normal colloquial variants and words that merely lack a stress mark. When unsure, do not report. Decide the addressee's gender from the context; if unclear, leave gendered forms as they are.

Phoneme notation (use exactly these symbols, nothing else):
consonants: b v ɡ d h z ʒ x t j k l m n s f p ts tʃ dʒ ʃ r ʔ   (ח and כ are both x; ע and א are silent or ʔ between vowels)
vowels: a e i o u
stress: ˈ placed immediately before the stressed vowel (korˈe, sˈefer, bamixbasˈa). Exactly one per word of two or more syllables.
Prefixes (ה, ו, ב, ל, מ, ש, כ) are part of the word: give the whole word.

"index" is the word's index in the provided list.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['corrections'],
  properties: {
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'word', 'ipa'],
        properties: { index: { type: 'integer' }, word: { type: 'string' }, ipa: { type: 'string' } },
      },
    },
  },
};

const VALID_IPA = /^[abdefhijklmnoprstuvxzɡʃʒʔˈ]+$/;
const EFFORT = process.env.PRONUNCIATION_EFFORT || 'medium';

/** Canonical form: stress mark directly before the stressed vowel, engine variants unified. */
export function canonical(ipa: string): string {
  return ipa
    .replace(/[\/\s.]/g, '')
    .replace(/g/g, 'ɡ')
    .replace(/['ˌ]/g, 'ˈ')
    .replace(/ɛ/g, 'e')
    .replace(/ɾ/g, 'r')
    .replace(/ˈ([^aeiouˈ]+)(?=[aeiou])/g, '$1ˈ');
}

/**
 * Is a proposed pronunciation a real change? Differences only in stress count when the engine
 * marked a stress itself (it often marks none), so correct words are not replaced needlessly.
 */
export function isRealChange(spoken: string, ipa: string): boolean {
  const a = canonical(spoken);
  const b = canonical(ipa);
  if (a === b) return false;
  const bare = (x: string) => x.replace(/[ˈʔ]/g, '');
  if (bare(a) !== bare(b)) return true;
  return a.includes('ˈ') && a.replace(/ʔ/g, '') !== b.replace(/ʔ/g, '');
}

/** Asks the language model which words the engine mispronounced. Never throws: returns null when the check could not run. */
export async function findFixes(tokens: SpokenToken[], context: string): Promise<Fix[] | null> {
  const key = process.env.OPENAI_API_KEY;
  const words = tokens
    .map((t, index) => ({ index, word: t.text.trim(), spoken: t.phones }))
    .filter((w) => hasLetters(w.word) && w.spoken);
  if (!words.length) return [];
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: `${context}\n\nLine: ${tokens.map((t) => t.text).join('')}\n\nWords as spoken by the engine:\n${JSON.stringify(words)}`,
        reasoning: { effort: EFFORT },
        text: { format: { type: 'json_schema', name: 'fixes', schema: SCHEMA, strict: true } },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    console.log('openai usage (pronunciation)', MODEL, EFFORT, JSON.stringify(data.usage));
    let out = '';
    for (const item of data.output ?? [])
      for (const c of item.content ?? []) if (c.type === 'output_text') out += c.text;
    const byIndex = new Map(words.map((w) => [w.index, w]));
    const fixes: Fix[] = [];
    for (const c of (JSON.parse(out).corrections ?? []) as Fix[]) {
      const ipa = canonical(String(c.ipa));
      const w = byIndex.get(c.index);
      if (!w || !VALID_IPA.test(ipa) || !isRealChange(w.spoken, ipa)) continue;
      fixes.push({ index: c.index, word: w.word, ipa });
    }
    return fixes;
  } catch (e) {
    console.error('pronunciation check failed', e);
    return null;
  }
}

/** Rebuilds the text with the corrected words replaced by inline IPA, which the engine speaks literally. */
export function applyFixes(tokens: SpokenToken[], fixes: Fix[]): string {
  const ipa = new Map(fixes.map((f) => [f.index, f.ipa]));
  return tokens
    .map((t, i) => {
      const fix = ipa.get(i);
      if (!fix) return t.text;
      const [, lead, , trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(t.text)!;
      return `${lead}/${fix}/${trail}`;
    })
    .join('');
}
