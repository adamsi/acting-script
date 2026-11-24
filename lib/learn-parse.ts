import { parseScript, speakersOf } from './script/parse';
import type { RawLine } from './script/types';
import type { Gender } from './types';

/** What the new-scene wizard starts from. Built by code only: no AI is involved. */
export interface LearnParsed {
  title: string;
  author: string;
  language: 'he' | 'en';
  characters: { name: string; gender: Gender; description: string }[];
  lines: { speaker: string; text: string }[];
  /** false when no speaker names were found: the user then assigns the speakers by hand */
  recognized: boolean;
}

const MALE = /^(הוא|אבא|סבא|הבעל|האיש|הגבר|הילד|הבן|הנער|הבחור|המלך|הדוד|אח|he|him|man|boy|father|dad|husband|king|mr\.?)$/i;
const FEMALE = /^(היא|אמא|אימא|סבתא|האישה|האשה|הילדה|הבת|הנערה|הבחורה|המלכה|הדודה|אחות|she|her|woman|girl|mother|mom|wife|queen|mrs\.?|ms\.?)$/i;

/**
 * A character's gender when its name says so outright ("הוא", "אמא", "Mrs."); otherwise unknown, and
 * the user chooses it in the wizard. Names are not guessed: a wrong voice is worse than a question.
 */
export function guessGender(name: string): Gender {
  const first = name.trim().split(/\s+/)[0] ?? '';
  if (MALE.test(name.trim()) || MALE.test(first)) return 'male';
  if (FEMALE.test(name.trim()) || FEMALE.test(first)) return 'female';
  return 'unknown';
}

/** Parses a script for the learning tool: speakers found by code, stage directions put in ( ). */
export function parseForLearning(raw: RawLine[], placeholders: [string, string]): LearnParsed {
  const p = parseScript(raw, { markDirections: true });
  const text = p.speeches.map((s) => s.text).join(' ');
  const hebrew = (text.match(/[֐-׿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const language = hebrew >= latin ? 'he' : 'en';

  if (!p.recognized) {
    // No names found: every line starts with the first placeholder character and the user sorts them out.
    return {
      title: p.title,
      author: p.author,
      language,
      recognized: false,
      characters: placeholders.map((name) => ({ name, gender: 'unknown' as Gender, description: '' })),
      lines: p.speeches.map((s) => ({ speaker: placeholders[0], text: s.text })),
    };
  }
  return {
    title: p.title,
    author: p.author,
    language,
    recognized: true,
    characters: speakersOf(p.speeches).map((name) => ({ name, gender: guessGender(name), description: '' })),
    lines: p.speeches.map((s) => ({ speaker: s.speaker, text: s.text })),
  };
}
