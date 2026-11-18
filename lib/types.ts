export type Gender = 'male' | 'female' | 'unknown';

export interface Character {
  id: string;
  name: string;
  gender: Gender;
  description: string;
  voice_id: string;
}

export interface Line {
  id: string;
  idx: number;
  character_id: string;
  text: string;
  spoken_text: string;
  has_audio: boolean;
  /** audio exists and matches the current text + voice */
  fresh: boolean;
  /** pronunciation of this recording was checked and corrected (or the user wrote it) */
  improved: boolean;
  hash: string;
  timings: number[][] | null;
}

export interface Script {
  id: string;
  title: string;
  author: string;
  language: 'he' | 'en';
  my_character_id: string | null;
  last_line_idx: number;
  original_name: string | null;
  characters: Character[];
  lines: Line[];
}

export interface ScriptSummary {
  id: string;
  title: string;
  author: string;
  my_name: string | null;
  line_count: number;
}

/** Editable form of a script (wizard + settings). `key` is a client-side handle. */
export interface DraftCharacter {
  key: string;
  id?: string;
  name: string;
  gender: Gender;
  description: string;
  voice_id: string;
}
export interface DraftLine {
  key: string;
  id?: string;
  speaker: string; // DraftCharacter.key
  text: string;
  spoken_text: string;
}
export interface Draft {
  title: string;
  author: string;
  language: 'he' | 'en';
  characters: DraftCharacter[];
  lines: DraftLine[];
  my: string; // DraftCharacter.key
}

export interface Voice {
  id: string;
  name: string;
  gender: Gender;
  lang: string;
  description: string;
}
