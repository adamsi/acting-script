// Pure text helpers shared by server and client.

export const hasLetters = (s: string) => /[\p{L}\p{N}]/u.test(s);

const DIRECTION_RE = /(\([^)]*\)|\[[^\]]*\])/;

/** Text that is actually spoken: stage directions in (parentheses) / [brackets] are removed. */
export function spokenText(text: string): string {
  return text
    .split(DIRECTION_RE)
    .filter((_, i) => i % 2 === 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Seg {
  t: string;
  /** stage direction (shown, never spoken) */
  dir: boolean;
  /** index among spoken words, or -1 for whitespace / punctuation / directions */
  n: number;
}

/** Splits a line into display segments, numbering the spoken words. */
export function segments(text: string): { segs: Seg[]; count: number } {
  const segs: Seg[] = [];
  let count = 0;
  text.split(DIRECTION_RE).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) {
      segs.push({ t: part, dir: true, n: -1 });
      return;
    }
    for (const tok of part.split(/(\s+)/)) {
      if (!tok) continue;
      segs.push({ t: tok, dir: false, n: hasLetters(tok) ? count++ : -1 });
    }
  });
  return { segs, count };
}

/** How many spoken words have started at time `t` (seconds). */
export function wordsSpoken(
  timings: number[][] | null | undefined,
  count: number,
  t: number,
  duration: number
): number {
  if (timings && timings.length === count) {
    let n = 0;
    while (n < timings.length && timings[n][0] <= t) n++;
    return n;
  }
  if (!duration || !isFinite(duration)) return 0;
  return Math.min(count, Math.ceil((t / duration) * count));
}
