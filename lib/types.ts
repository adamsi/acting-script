export type Gender = 'male' | 'female' | 'unknown';
/** How the other characters' lines are recorded: AI voices (Inworld) or the user's own voice. */
export type RecordingMode = 'ai' | 'own';

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
  /** who made the recording: an AI voice or the user's own microphone */
  source: RecordingMode | null;
  hash: string;
  timings: number[][] | null;
}

export interface Script {
  id: string;
  title: string;
  author: string;
  language: 'he' | 'en';
  my_character_id: string | null;
  recording_mode: RecordingMode;
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
  recording_mode?: RecordingMode;
}

export interface Voice {
  id: string;
  name: string;
  gender: Gender;
  lang: string;
  description: string;
}
