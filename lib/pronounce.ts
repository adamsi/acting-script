const HEB = '֐-׿';

/**
 * Typography the speech engine needs: an ASCII apostrophe after a Hebrew letter is read as the
 * letter's name ("ג'סי" → "gimel-si"), the Hebrew geresh / gershayim are read correctly.
 */
export function normalizeHebrew(text: string): string {
  return text
    .replace(new RegExp(`([${HEB}])['’‘](?=[${HEB}])`, 'g'), '$1׳')
    .replace(new RegExp(`([${HEB}])["”“](?=[${HEB}])`, 'g'), '$1״');
}
