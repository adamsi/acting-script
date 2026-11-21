import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

export interface ChubbuckInput {
  title: string;
  author: string;
  /** one table row per speech, in script order */
  lines: { speaker: string; text: string }[];
}

const FONT = 'Arial';
// A4 landscape with 1.5cm margins, in twentieths of a point.
const PAGE_W = 16838;
const PAGE_H = 11906;
const MARGIN = 850;
const WIDTH = PAGE_W - 2 * MARGIN;

/** General fields above the table: label and number of writing lines. */
const FIELDS: [string, number][] = [
  ['מטרת העל:', 1],
  ['תחליף:', 1],
  ['מטרת הסצינה:', 1],
  ['מכשולים:', 3],
  ['רגע לפני:', 3],
  ['נסיבות מקדימות:', 3],
  ['חלל וקיר רביעי:', 1],
];

/** Table columns, first one is the rightmost (Hebrew). The inner-dialogue column is the widest. */
const COLUMNS: [string, number][] = [
  ['טקסט + אובייקטים פנימיים + סימון ביטים', 0.31],
  ['פעולות', 0.12],
  ['מכשולים', 0.12],
  ['Doings', 0.12],
  ['דיאלוג פנימי', 0.33],
];
const COL_W = COLUMNS.map(([, f]) => Math.round(WIDTH * f));
COL_W[COL_W.length - 1] += WIDTH - COL_W.reduce((a, b) => a + b, 0);

const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, rightToLeft: true, size: opts.size ?? 22, bold: opts.bold, color: opts.color });

const para = (children: TextRun[], opts: { center?: boolean; before?: number; after?: number } = {}) =>
  new Paragraph({
    bidirectional: true,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.START,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: 276 },
    children,
  });

const line = (style: (typeof BorderStyle)[keyof typeof BorderStyle], size: number, color: string) => ({ style, size, color });
const NONE = line(BorderStyle.NONE, 0, 'FFFFFF');
const FRAME = line(BorderStyle.SINGLE, 12, '000000');
const GRID = line(BorderStyle.SINGLE, 6, '000000');

/** The framed box of general questions, with ruled lines to write on. */
function fieldsBox(): Table {
  const rows: TableRow[] = [];
  FIELDS.forEach(([label, lines], f) => {
    for (let i = 0; i < lines; i++) {
      const lastOfField = i === lines - 1;
      const lastOfBox = lastOfField && f === FIELDS.length - 1;
      rows.push(
        new TableRow({
          cantSplit: true,
          height: { value: 520, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: WIDTH, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 40, bottom: 40, left: 160, right: 160 },
              borders: {
                top: f === 0 && i === 0 ? FRAME : NONE,
                left: FRAME,
                right: FRAME,
                bottom: lastOfBox ? FRAME : lastOfField ? line(BorderStyle.SINGLE, 6, '7F7F7F') : line(BorderStyle.DOTTED, 4, 'A6A6A6'),
              },
              children: [para(i === 0 ? [run(label, { bold: true }), run(' ')] : [run('')])],
            }),
          ],
        })
      );
    }
  });
  return new Table({
    visuallyRightToLeft: true,
    layout: TableLayoutType.FIXED,
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [WIDTH],
    rows,
  });
}

function cell(children: Paragraph[], width: number, header = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: header ? VerticalAlign.CENTER : VerticalAlign.TOP,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    borders: { top: GRID, bottom: GRID, left: GRID, right: GRID },
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' } : undefined,
    children,
  });
}

function workTable(lines: ChubbuckInput['lines']): Table {
  const header = new TableRow({
    tableHeader: true, // repeated at the top of every page
    cantSplit: true,
    children: COLUMNS.map(([title], i) => cell([para([run(title, { bold: true, size: 21 })], { center: true })], COL_W[i], true)),
  });
  const rows = lines.map(
    (l) =>
      new TableRow({
        // Short speeches stay whole on a page; a long monologue may continue on the next one.
        cantSplit: l.text.length < 700,
        height: { value: 1000, rule: HeightRule.ATLEAST },
        children: [
          cell([para([run(l.speaker, { bold: true })], { after: 40 }), ...l.text.split(/\n+/).map((t) => para([run(t.trim())]))], COL_W[0]),
          ...COL_W.slice(1).map((w) => cell([para([run('')])], w)),
        ],
      })
  );
  return new Table({
    visuallyRightToLeft: true,
    layout: TableLayoutType.FIXED,
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: COL_W,
    rows: [header, ...rows],
  });
}

/** Builds the Chubbuck worksheet (.docx): title, general questions box, and one table row per speech. */
export async function buildChubbuckDocx(input: ChubbuckInput): Promise<Buffer> {
  const doc = new Document({
    creator: 'Acting Tools',
    title: input.title,
    styles: { default: { document: { run: { font: FONT, size: 22, rightToLeft: true } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_H, height: PAGE_W, orientation: PageOrientation.LANDSCAPE },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '7F7F7F' })],
              }),
            ],
          }),
        },
        children: [
          para([run(input.title || 'סצנה', { bold: true, size: 32 })], { center: true }),
          ...(input.author ? [para([run(input.author, { size: 22, color: '595959' })], { center: true })] : []),
          para([run('טבלת עבודה בשיטת צ׳באק', { size: 20, color: '7F7F7F' })], { center: true, after: 200 }),
          fieldsBox(),
          // The general questions fill the first page; the table starts on a new one.
          new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 20 }, children: [] }),
          workTable(input.lines),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
