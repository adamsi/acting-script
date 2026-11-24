// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { guessGender, parseForLearning } from '../lib/learn-parse';
import { proportionalTimings } from '../lib/client';
import { readScript } from '../lib/script/read';
import { parseScript } from '../lib/script/parse';
import { spokenText } from '../lib/text';
import type { RawLine } from '../lib/script/types';

const L = (text: string, o: Partial<RawLine> = {}): RawLine => ({ text, bold: false, boldPrefix: '', ...o });
const name = (text: string, o: Partial<RawLine> = {}) => L(text, { bold: true, ...o });

describe('stage directions in the learning tool', () => {
  it('puts narration that is aligned differently from the dialogue into ( ), so it is not spoken', () => {
    const raw = [
      L('כותרת', { bold: true, centered: false }),
      name('דנה', { centered: true }), L('שלום, מה שלומך?', { centered: true }),
      name('יוסי', { centered: true }), L('בסדר גמור.', { centered: true }),
      L('יוסי מוזג קפה.', { centered: false }),
      name('דנה', { centered: true }), L('תודה.', { centered: true }), L('ועוד משהו.', { centered: true }),
      L('היא קמה.', { centered: false }), L('והולכת לדלת.', { centered: false }),
      name('יוסי', { centered: true }), L('להתראות.', { centered: true }),
    ];
    const p = parseForLearning(raw, ['א', 'ב']);
    expect(p.lines.map((l) => l.text)).toEqual(['שלום, מה שלומך?', 'בסדר גמור. (יוסי מוזג קפה.)', 'תודה. ועוד משהו. (היא קמה. והולכת לדלת.)', 'להתראות.']);
    // What is said: only the dialogue.
    expect(p.lines.map((l) => spokenText(l.text))).toEqual(['שלום, מה שלומך?', 'בסדר גמור.', 'תודה. ועוד משהו.', 'להתראות.']);
    // Without the option the text is left exactly as written.
    expect(parseScript(raw).speeches[1].text).toBe('בסדר גמור. יוסי מוזג קפה.');
  });

  it('marks italic lines inside a speech as directions, and leaves bracketed ones alone', () => {
    const raw = [
      name('דנה'), L('שלום לך.'), L('היא מחייכת', { italic: true }),
      name('יוסי'), L('(בשקט)'), L('היי.'),
      name('דנה'), L('מה חדש?'), L('פאוזה ארוכה', { italic: true }), L('ספר לי.'),
      name('יוסי'), L('כלום.'),
    ];
    const p = parseForLearning(raw, ['א', 'ב']);
    expect(p.lines.map((l) => l.text)).toEqual(['שלום לך. (היא מחייכת)', '(בשקט) היי.', 'מה חדש? (פאוזה ארוכה) ספר לי.', 'כלום.']);
  });

  it('does not mark anything when the whole dialogue looks the same', async () => {
    const buf = readFileSync(join(__dirname, 'fixtures', 'bold-own-line.docx'));
    const raw = await readScript(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'x.docx');
    const p = parseForLearning(raw, ['א', 'ב']);
    expect(p.lines.map((l) => l.text)).toEqual(parseScript(raw).speeches.map((s) => s.text));
    expect(p.language).toBe('he');
    expect(p.characters.map((c) => c.name)).toEqual(['דנה', 'יוסי', 'מיכל']);
  });

  it('gives placeholder characters when no speaker names are found', async () => {
    const buf = readFileSync(join(__dirname, 'fixtures', 'no-speakers.txt'));
    const p = parseForLearning(await readScript(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'x.txt'), ['דמות א', 'דמות ב']);
    expect(p.recognized).toBe(false);
    expect(p.characters.map((c) => c.name)).toEqual(['דמות א', 'דמות ב']);
    expect(p.lines.every((l) => l.speaker === 'דמות א')).toBe(true);
  });

  it('detects English scripts', async () => {
    const buf = readFileSync(join(__dirname, 'fixtures', 'english-caps.txt'));
    const p = parseForLearning(await readScript(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'x.txt'), ['A', 'B']);
    expect(p.language).toBe('en');
  });
});

describe('gender from a name', () => {
  it('is only decided when the name says so outright', () => {
    expect(guessGender('הוא')).toBe('male');
    expect(guessGender('היא')).toBe('female');
    expect(guessGender('אמא של דנה')).toBe('female');
    expect(guessGender('Mr. Smith')).toBe('male');
    expect(guessGender('דנה')).toBe('unknown');
    expect(guessGender('מדריך')).toBe('unknown');
  });
});

describe('timings for a recording the user made', () => {
  it('spreads the spoken words over the recording, skipping stage directions', () => {
    const t = proportionalTimings('(בשקט) אב גדהו', 3);
    expect(t).toHaveLength(2);
    expect(t[0]).toEqual([0, 1]);
    expect(t[1]).toEqual([1, 3]);
    expect(proportionalTimings('(רק בימוי)', 3)).toEqual([]);
    expect(proportionalTimings('שלום', 0)).toEqual([]);
  });
});
