export interface Usage {
  used: number;
  limit: number;
  /** ISO date when the monthly count resets */
  resets: string;
  /** this user's script size limits */
  maxPages: number;
  maxWords: number;
}

/** How long a script a user may upload. */
export interface ScriptLimits {
  maxPages: number;
  maxWords: number;
}
