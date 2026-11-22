import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildChubbuckDocx } from '../lib/chubbuck';

describe('Chubbuck worksheet file', () => {
  it('has the box, then a table with the columns in order, no lines between speeches and no page break', async () => {
    const file = await buildChubbuckDocx({
      title: 'קפה של בוקר',
      author: 'נועה לוי',
      lines: [
        { speaker: 'דנה', text: 'בוקר טוב' },
        { speaker: 'יוסי', text: 'שלום' },
      ],
    });
    const xml = await (await JSZip.loadAsync(file)).file('word/document.xml')!.async('string');
    const tables = xml.split('<w:tbl>').slice(1);
    expect(tables).toHaveLength(2);
    const table = tables[1];
    expect(table.match(/<w:tr[ >]/g)).toHaveLength(3); // header + one row per speech

    // Right to left: obstacles, text, actions, doings, inner dialogue (the first cell in the file is the rightmost).
    const at = (label: string) => table.indexOf(label);
    expect(at('מכשולים')).toBeLessThan(at('טקסט + אובייקטים פנימיים + סימון ביטים'));
    expect(at('טקסט + אובייקטים פנימיים + סימון ביטים')).toBeLessThan(at('פעולות'));
    expect(at('פעולות')).toBeLessThan(at('Doings'));
    expect(at('Doings')).toBeLessThan(at('דיאלוג פנימי'));

    // Only the header row has top lines; the last row closes the table; nothing between speeches.
    expect(table.match(/<w:top w:val="single"/g)).toHaveLength(5);
    expect(table.match(/<w:bottom w:val="single"/g)).toHaveLength(10);
    expect(xml).not.toContain('pageBreakBefore');
  });
});
