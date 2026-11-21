export interface Usage {
  used: number;
  limit: number;
  /** ISO date when the monthly count resets */
  resets: string;
}
