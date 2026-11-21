'use client';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'he' | 'en';

const dict = {
  appName: ['חזרה על טקסט', 'Script Rehearsal'],
  welcome: ['מתרגלים סצנה לבד: האפליקציה מקריאה את שאר הדמויות ומחכה לך בתור שלך.', 'Rehearse a scene on your own: the app reads the other characters and waits for you on your lines.'],
  welcome1: ['מעלים קובץ PDF או Word של הסצנה', 'Upload a PDF or Word file of the scene'],
  welcome2: ['בוחרים איזו דמות אתם', 'Choose which character you are'],
  welcome3: ['שאר הדמויות מדברות בקול, ואתם עונים', 'The other characters speak aloud, and you answer'],
  signUp: ['הרשמה', 'Sign up'],
  haveAccount: ['כבר יש לי חשבון · כניסה', 'I already have an account · Sign in'],
  usage: ['סצנות חדשות החודש', 'new scenes this month'],
  limitReached: ['הגעת למגבלה החודשית של סצנות חדשות', 'You have reached this month\'s limit of new scenes'],
  limitResets: ['המגבלה מתאפסת ב־', 'The limit resets on '],
  errMonthlyLimit: ['הגעת למגבלה החודשית (20 סצנות חדשות בחודש)', 'Monthly limit reached (20 new scenes per month)'],
  errTooLong: ['הטקסט ארוך מדי (עד 30 עמודים)', 'The script is too long (max 30 pages)'],
  errBadFile: ['לא ניתן לקרוא את הקובץ', 'This file could not be read'],
  uploadLimits: ['עד 30 עמודים, עד 4MB', 'Up to 30 pages, up to 4MB'],
  myScenes: ['הסצנות שלי', 'My scenes'],
  noScenes: ['עדיין אין סצנות. העלה קובץ כדי להתחיל.', 'No scenes yet. Upload a file to start.'],
  newScene: ['סצנה חדשה', 'New scene'],
  linesCount: ['שורות', 'lines'],
  iAm: ['אני', 'I am'],
  loading: ['טוען…', 'Loading…'],
  error: ['משהו השתבש', 'Something went wrong'],
  retry: ['נסה שוב', 'Try again'],
  back: ['חזרה', 'Back'],
  uploadTitle: ['העלאת סצנה', 'Upload a scene'],
  uploadHint: ['קובץ PDF או Word עם הטקסט של הסצנה', 'A PDF or Word file with the scene text'],
  chooseFile: ['בחר קובץ', 'Choose file'],
  analyzing: ['מנתח את הטקסט…', 'Analyzing the script…'],
  analyzingHint: ['זה יכול לקחת עד דקה', 'This can take up to a minute'],
  stepUpload: ['קובץ', 'File'],
  stepRecord: ['הקלטה', 'Recording'],
  recordingHint: ['מקליט את השורות של שאר הדמויות', "Recording the other characters' lines"],
  stepCharacters: ['דמויות', 'Characters'],
  stepLines: ['טקסט', 'Lines'],
  checkCharacters: ['בדוק שהדמויות זוהו נכון ובחר מי אתה', 'Check the characters and choose who you are'],
  checkLines: ['בדוק שהטקסט והדוברים נכונים', 'Check that the text and speakers are right'],
  title: ['כותרת', 'Title'],
  author: ['מחבר', 'Author'],
  name: ['שם', 'Name'],
  male: ['גבר', 'Male'],
  female: ['אישה', 'Female'],
  voice: ['קול', 'Voice'],
  listen: ['השמע', 'Listen'],
  thisIsMe: ['זה אני', 'This is me'],
  me: ['אני', 'Me'],
  addCharacter: ['הוסף דמות', 'Add character'],
  remove: ['הסר', 'Remove'],
  hasLines: ['לדמות יש שורות', 'Character has lines'],
  next: ['המשך', 'Next'],
  previous: ['הקודם', 'Previous'],
  confirmSave: ['אישור ושמירה', 'Confirm & save'],
  save: ['שמור', 'Save'],
  saving: ['שומר…', 'Saving…'],
  saved: ['נשמר', 'Saved'],
  addLineBelow: ['הוסף שורה מתחת', 'Add line below'],
  deleteLine: ['מחק שורה', 'Delete line'],
  directionsHint: [
    'טקסט בסוגריים הוא הוראת בימוי — מוצג אבל לא נאמר',
    'Text in (parentheses) is a stage direction — shown but not spoken',
  ],
  pronunciation: ['הגייה: כתיב פונטי או ‎/IPA/', 'Pronunciation: phonetic spelling or /IPA/'],
  needRecording: ['שורות בלי הקלטה עדכנית. בלי הקלטה השורה תוצג כטקסט בלבד.', 'lines have no up-to-date recording. Without one the line is shown as text only.'],
  createRecordings: ['צור הקלטות', 'Create recordings'],
  improve: ['שפר הגייה בעברית', 'Improve Hebrew pronunciation'],
  improveHint: ['בודק כל מילה שהוקלטה ומתקן מילים שנאמרו לא נכון. לוקח כמה דקות.', 'Checks every recorded word and fixes mispronounced ones. Takes a few minutes.'],
  improving: ['משפר הגייה…', 'Improving pronunciation…'],
  improvingHint: ['אפשר להשאיר את המסך פתוח, זה לוקח כמה דקות', 'Keep this screen open, it takes a few minutes'],
  improvedWords: ['מילים תוקנו', 'words corrected'],
  improveFailed: ['בדיקת ההגייה נכשלה בחלק מהשורות. נסה שוב מאוחר יותר.', 'The pronunciation check failed for some lines. Try again later.'],
  improvedDone: ['ההגייה נבדקה', 'Pronunciation checked'],
  regenerate: ['הקלט מחדש', 'Re-record'],
  regenerateAll: ['הקלט מחדש את כל השורות', 'Re-record all lines'],
  regenerateAllConfirm: ['ליצור מחדש את כל ההקלטות?', 'Re-create all recordings?'],
  recording: ['מקליט את הדמויות…', 'Recording the characters…'],
  recordingFailed: ['חלק מההקלטות נכשלו', 'Some recordings failed'],
  play: ['התחל', 'Play'],
  fromStart: ['מההתחלה', 'From the start'],
  continueFrom: ['המשך משורה', 'Continue from line'],
  tapLineToStart: ['אפשר להקיש על שורה כדי להתחיל ממנה', 'Tap any line to start from it'],
  settings: ['הגדרות', 'Settings'],
  originalFile: ['הקובץ המקורי', 'Original file'],
  memorize: ['הסתר את השורות שלי (שינון)', 'Hide my lines (memorize)'],
  speed: ['מהירות דיבור', 'Speech speed'],
  deleteScene: ['מחק סצנה', 'Delete scene'],
  deleteSceneConfirm: ['למחוק את הסצנה וכל ההקלטות?', 'Delete this scene and all its recordings?'],
  chooseMe: ['בחר מי אתה כדי להתחיל', 'Choose who you are to start'],
  yourTurn: ['תורך', 'Your turn'],
  tapWhenDone: ['הקש על המסך כשסיימת', 'Tap the screen when you finish'],
  tapWhenDoneKb: ['או Enter', 'or press Enter'],
  tapToSkip: ['הקש כדי לדלג', 'Tap to skip'],
  noRecording: ['אין הקלטה לשורה הזו — הקש כדי להמשיך', 'No recording for this line — tap to continue'],
  show: ['הצג', 'Show'],
  paused: ['מושהה — הקש כדי להמשיך', 'Paused — tap to resume'],
  pause: ['השהה', 'Pause'],
  resume: ['המשך', 'Resume'],
  prevLine: ['אחורה', 'Back'],
  replayCue: ['קיו שוב', 'Cue again'],
  exit: ['יציאה', 'Exit'],
  theEnd: ['סוף הסצנה', 'End of scene'],
  again: ['שוב מההתחלה', 'Again from the start'],
  upNext: ['בהמשך', 'Up next'],
  characters: ['דמויות', 'Characters'],
  lines: ['שורות', 'Lines'],
  unsupported: ['סוג קובץ לא נתמך', 'Unsupported file type'],
  tooBig: ['הקובץ גדול מדי (עד 4MB)', 'File is too large (max 4MB)'],
  sample: ['שלום, אני אקרא איתך את הסצנה הזאת.', "Hi, I'll be reading this scene with you."],
} as const;

export type Key = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; t: (k: Key) => string; setLang: (l: Lang) => void }>({
  lang: 'he',
  t: (k) => dict[k][0],
  setLang: () => {},
});

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);
  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      // A cookie, so the server renders the right language and direction (and Clerk's forms follow).
      document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router]
  );
  const t = useCallback((k: Key) => dict[k][lang === 'he' ? 0 : 1], [lang]);
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

/** Text for an API error: translated when the server sent a known code. */
export function errorText(e: unknown, t: (k: Key) => string): string {
  const code = (e as { code?: string })?.code;
  const known: Record<string, Key> = {
    monthly_limit: 'errMonthlyLimit',
    file_too_large: 'tooBig',
    script_too_long: 'errTooLong',
    bad_file: 'errBadFile',
    unsupported: 'unsupported',
  };
  if (code && known[code]) return t(known[code]);
  return e instanceof Error ? e.message : String(e);
}

export const useI18n = () => useContext(Ctx);
