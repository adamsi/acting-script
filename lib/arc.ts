/** "Character arc": the scenes of one character, summarised, with the questions the actor fills in. */

export interface ArcScene {
  /** the scene's number as the script gives it ("12", "12א", "3.4") */
  number: string;
  /** up to four lines, in the first person, facts and behaviour only */
  summary: string;
  /** what the actor wrote under each of ARC_FIELDS (same order); missing until they write something */
  answers?: string[];
}

/** One uploaded script (a film, a play, or one episode of a series). */
export interface ArcPart {
  fileName: string;
  scenes: ArcScene[];
}

export const MAX_ARC_FILES = 12;
export const MAX_ARC_CHARS = 400_000;
export const MAX_ARC_NAME = 60;

/** A saved analysis, as listed. */
export interface ArcSummary {
  id: string;
  character: string;
  files: number;
  scenes: number;
  updated_at: string;
}

export interface SavedArc {
  id: string;
  character: string;
  parts: ArcPart[];
  updated_at: string;
}

/** The questions after every scene, for the actor to answer. */
export const ARC_FIELDS = ['מטרת הסצינה:', 'ביטים מרכזיים:', 'איך אני נכנס/ת לסצינה:', 'איך אני יוצא/ת מהסצינה:'];

export const arcTitle = (character: string) => `ניתוח מהלך של דמות: ${character}`;
const partTitle = (fileName: string) => fileName.replace(/\.[^.]+$/, '');
export const sceneTitle = (number: string) => `סצינה ${number}`;

/** The whole document as plain text, for copying into a word processor. */
export function arcToText(character: string, parts: ArcPart[]): string {
  const out: string[] = [arcTitle(character), ''];
  for (const part of parts) {
    if (parts.length > 1) out.push(partTitle(part.fileName), '');
    for (const s of part.scenes) {
      out.push(sceneTitle(s.number), s.summary, '');
      ARC_FIELDS.forEach((f, i) => out.push(f, s.answers?.[i]?.trim() ?? '', ''));
    }
  }
  return out.join('\n').trimEnd() + '\n';
}

/** The document as a Word file (right-to-left), built in the browser. */
export async function arcToDocx(character: string, parts: ArcPart[]): Promise<Blob> {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import('docx');
  const FONT = 'Arial';
  const p = (text: string, o: { bold?: boolean; size?: number; before?: number; after?: number; center?: boolean; color?: string } = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: o.center ? AlignmentType.CENTER : AlignmentType.START,
      spacing: { before: o.before ?? 0, after: o.after ?? 80, line: 300 },
      children: [new TextRun({ text, bold: o.bold, size: o.size ?? 24, font: FONT, rightToLeft: true, color: o.color })],
    });
  const children = [p(arcTitle(character), { bold: true, size: 36, center: true, after: 300 })];
  for (const part of parts) {
    if (parts.length > 1) children.push(p(partTitle(part.fileName), { bold: true, size: 30, before: 300, after: 160 }));
    for (const s of part.scenes) {
      children.push(p(sceneTitle(s.number), { bold: true, size: 26, before: 240 }));
      for (const line of s.summary.split('\n')) children.push(p(line));
      ARC_FIELDS.forEach((f, i) => {
        children.push(p(f, { bold: true, before: 160 }));
        for (const line of (s.answers?.[i]?.trim() ?? '').split('\n')) children.push(p(line));
      });
    }
  }
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }] });
  return Packer.toBlob(doc);
}
