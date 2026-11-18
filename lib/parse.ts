import mammoth from 'mammoth';
import type { Gender } from './types';

export interface Parsed {
  title: string;
  author: string;
  language: 'he' | 'en';
  characters: { name: string; gender: Gender; description: string }[];
  lines: { speaker: string; text: string }[];
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'author', 'language', 'characters', 'lines'],
  properties: {
    title: { type: 'string' },
    author: { type: 'string' },
    language: { type: 'string', enum: ['he', 'en'] },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'gender', 'description'],
        properties: {
          name: { type: 'string' },
          gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
          description: { type: 'string' },
        },
      },
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['speaker', 'text'],
        properties: { speaker: { type: 'string' }, text: { type: 'string' } },
      },
    },
  },
};

const INSTRUCTIONS = `You convert an acting scene (script) document into structured data for a line-rehearsal app.

Rules:
- Identify every speaking character. Speaker names usually appear on their own line before the dialogue, often bold or underlined, but may not be formatted at all. Use the exact name as written.
- Output every dialogue line in document order, as { speaker, text }. "speaker" must exactly match one of the character names.
- One entry per speaker turn: merge all consecutive text spoken by the same character before the next speaker name into a single line (joined with spaces).
- Copy the dialogue text VERBATIM in its original language. Do not translate, correct, shorten, add vowel points, or paraphrase.
- Keep stage directions inline in the text, in parentheses, exactly where they occur, e.g. "(pause) No." A stage direction that stands alone between speeches belongs to the speech it sits in or precedes.
- Fix only extraction artifacts: punctuation that appears at the wrong end of a right-to-left line (e.g. "?אתה נקי עכשיו" must become "אתה נקי עכשיו?"), stray line breaks, repeated headers/footers, page numbers and logos (omit those).
- title: the scene/play title. author: the writer if present, else "".
- language: "he" if the dialogue is Hebrew, otherwise "en".
- gender: infer from the name, grammar (Hebrew verb/adjective gender) and context; use "unknown" only if truly unclear.
- description: a very short (max 8 words) note about the character in the document's language, or "".`;

export async function parseScript(file: Buffer, name: string, mime: string): Promise<Parsed> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  const lower = name.toLowerCase();
  const content: unknown[] = [];
  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    content.push({
      type: 'input_file',
      filename: 'script.pdf',
      file_data: `data:application/pdf;base64,${file.toString('base64')}`,
    });
  } else if (lower.endsWith('.docx')) {
    const { value } = await mammoth.convertToHtml({ buffer: file });
    content.push({ type: 'input_text', text: `Document converted to HTML (bold preserved):\n\n${value}` });
  } else if (lower.endsWith('.txt') || mime.startsWith('text/')) {
    content.push({ type: 'input_text', text: file.toString('utf8') });
  } else {
    throw new Error('Unsupported file type. Upload a PDF, Word (.docx) or text file.');
  }
  content.push({ type: 'input_text', text: 'Extract the scene from this document.' });

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      instructions: INSTRUCTIONS,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'scene', schema: SCHEMA, strict: true } },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  let out = '';
  for (const item of data.output ?? [])
    for (const c of item.content ?? []) if (c.type === 'output_text') out += c.text;
  if (!out) throw new Error('OpenAI returned no content');
  const parsed = JSON.parse(out) as Parsed;

  // Make sure every speaker has a character entry.
  const names = new Set(parsed.characters.map((c) => c.name));
  for (const l of parsed.lines) {
    if (!names.has(l.speaker)) {
      names.add(l.speaker);
      parsed.characters.push({ name: l.speaker, gender: 'unknown', description: '' });
    }
  }
  parsed.lines = parsed.lines.filter((l) => l.text.trim());
  return parsed;
}
