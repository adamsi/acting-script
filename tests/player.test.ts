import { describe, expect, it } from 'vitest';
import { reduce, start, type Kind, type PlayerEvent, type PState } from '../lib/player';
import { segments, spokenText, wordsSpoken } from '../lib/text';

const run = (kinds: Kind[], s: PState, ...evs: PlayerEvent[]) => evs.reduce((st, ev) => reduce(kinds, st, ev), s);

describe('player state machine', () => {
  it('waits immediately when the scene opens with my line', () => {
    const s = start(['mine', 'other'], 0);
    expect(s).toMatchObject({ idx: 0, phase: 'waiting' });
    expect(reduce(['mine', 'other'], s, 'ended')).toBe(s); // stray audio event never advances my line
    expect(reduce(['mine', 'other'], s, 'tap')).toMatchObject({ idx: 1, phase: 'speaking' });
  });

  it('speaks consecutive other lines automatically and stops at mine', () => {
    const k: Kind[] = ['other', 'other', 'mine', 'mine', 'other'];
    let s = start(k);
    expect(s.phase).toBe('speaking');
    s = run(k, s, 'ended');
    expect(s).toMatchObject({ idx: 1, phase: 'speaking' });
    s = run(k, s, 'ended');
    expect(s).toMatchObject({ idx: 2, phase: 'waiting' });
    s = run(k, s, 'tap');
    expect(s).toMatchObject({ idx: 3, phase: 'waiting' }); // consecutive lines of mine: one tap each
    s = run(k, s, 'tap');
    expect(s).toMatchObject({ idx: 4, phase: 'speaking' });
    s = run(k, s, 'ended');
    expect(s.phase).toBe('done');
  });

  it('ends after my last line and ignores taps when done', () => {
    const k: Kind[] = ['other', 'mine'];
    const s = run(k, start(k), 'ended', 'tap');
    expect(s.phase).toBe('done');
    expect(reduce(k, s, 'tap')).toBe(s);
  });

  it('tap while the app speaks skips the line', () => {
    const k: Kind[] = ['other', 'other', 'mine'];
    expect(run(k, start(k), 'tap')).toMatchObject({ idx: 1, phase: 'speaking' });
  });

  it('falls back to waiting when audio fails, then continues on tap', () => {
    const k: Kind[] = ['other', 'mine'];
    const s = run(k, start(k), 'fail');
    expect(s).toMatchObject({ idx: 0, phase: 'waiting' });
    expect(run(k, s, 'tap')).toMatchObject({ idx: 1, phase: 'waiting' });
  });

  it('passes over direction-only lines with a silent beat', () => {
    const k: Kind[] = ['silent', 'mine'];
    const s = start(k);
    expect(s.phase).toBe('pausing');
    expect(run(k, s, 'ended')).toMatchObject({ idx: 1, phase: 'waiting' });
  });

  it('replays the last cue and goes back a line', () => {
    const k: Kind[] = ['other', 'mine', 'mine'];
    const s = run(k, start(k), 'ended', 'tap'); // at idx 2, waiting
    expect(run(k, s, 'cue')).toMatchObject({ idx: 0, phase: 'speaking' });
    expect(run(k, s, 'back')).toMatchObject({ idx: 1, phase: 'waiting' });
    expect(run(k, start(k), 'back')).toMatchObject({ idx: 0 });
    const first = start(['mine', 'other']);
    expect(reduce(['mine', 'other'], first, 'cue')).toBe(first); // no cue before the first line
  });

  it('starts from any line and bumps the nonce on every transition', () => {
    const k: Kind[] = ['other', 'mine', 'other'];
    const s = start(k, 1);
    expect(s).toMatchObject({ idx: 1, phase: 'waiting' });
    expect(run(k, s, 'cue', 'cue').nonce).toBe(s.nonce + 2);
  });
});

describe('text helpers', () => {
  it('removes stage directions from spoken text', () => {
    expect(spokenText('(מוחא כפיים) ארבעה ימים. (פאוזה) לא.')).toBe('ארבעה ימים. לא.');
    expect(spokenText('(בכעס)')).toBe('');
  });
  it('numbers spoken words only', () => {
    const { segs, count } = segments('(פאוזה) אנחנו לא פה - כדי לשפוט.');
    expect(count).toBe(5);
    expect(segs[0]).toMatchObject({ dir: true, n: -1 });
    expect(segs.filter((s) => s.n >= 0).map((s) => s.t)).toEqual(['אנחנו', 'לא', 'פה', 'כדי', 'לשפוט.']);
  });
  it('tracks progress from timings or falls back to proportion', () => {
    const timings = [[0, 0.4], [0.5, 0.9], [1, 1.5]];
    expect(wordsSpoken(timings, 3, 0.6, 2)).toBe(2);
    expect(wordsSpoken(timings, 4, 1, 2)).toBe(2); // mismatch: proportional
    expect(wordsSpoken(null, 4, 0, 0)).toBe(0);
  });
});

import { applyFixes, canonical, isRealChange, normalizeHebrew } from '../lib/pronounce';

describe('pronunciation helpers', () => {
  it('turns ASCII apostrophes inside Hebrew words into geresh / gershayim', () => {
    expect(normalizeHebrew("ג'סי וצה\"ל, it's")).toBe('ג׳סי וצה״ל, it\'s');
  });
  it('moves the stress mark to the vowel and unifies engine symbols', () => {
    expect(canonical('/niˈsita/')).toBe('nisˈita');
    expect(canonical('lɛhavɾiax')).toBe('lehavriax');
  });
  it('ignores stress-only proposals unless the engine stressed another syllable', () => {
    expect(isRealChange('tipalt', 'tipˈalt')).toBe(false);
    expect(isRealChange('haraɡtˈi', 'harˈaɡti')).toBe(true);
    expect(isRealChange('bamaxbesa', 'bamixbasˈa')).toBe(true);
    expect(isRealChange('korˈe', 'koˈre')).toBe(false);
  });
  it('replaces only the corrected words, keeping spacing and punctuation', () => {
    const tokens = ['', 'אתה', ' ', 'עובד', ' ', 'במכבסה', '?', ''].map((text) => ({ text, phones: '' }));
    expect(applyFixes(tokens, [{ index: 5, word: 'במכבסה', ipa: 'bamixbasˈa' }])).toBe('אתה עובד /bamixbasˈa/?');
  });
});

import { PDFDocument } from 'pdf-lib';
import { assertFileSize, assertPdfPages, assertTextLength, MAX_CHARS, MAX_FILE_BYTES, MAX_PAGES } from '../lib/limits';

describe('upload limits', () => {
  const pdf = async (pages: number) => {
    const d = await PDFDocument.create();
    for (let i = 0; i < pages; i++) d.addPage([200, 200]);
    return Buffer.from(await d.save());
  };
  it('accepts a script of exactly the page limit and rejects one page more', async () => {
    await expect(assertPdfPages(await pdf(MAX_PAGES))).resolves.toBeUndefined();
    await expect(assertPdfPages(await pdf(MAX_PAGES + 1))).rejects.toMatchObject({ code: 'script_too_long', status: 413 });
  });
  it('rejects an unreadable PDF', async () => {
    await expect(assertPdfPages(Buffer.from('nope'))).rejects.toMatchObject({ code: 'bad_file' });
  });
  it('limits text length and file size', () => {
    expect(() => assertTextLength('א'.repeat(MAX_CHARS))).not.toThrow();
    expect(() => assertTextLength('א'.repeat(MAX_CHARS + 1))).toThrow();
    expect(() => assertFileSize(MAX_FILE_BYTES)).not.toThrow();
    expect(() => assertFileSize(MAX_FILE_BYTES + 1)).toThrow();
  });
});
