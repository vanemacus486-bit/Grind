/**
 * Parse imported text into word entries.
 * Supports:
 *   - One word per line (no meaning)
 *   - word<tab>meaning
 *   - word,meaning
 *   - word|meaning
 */
export interface ParsedEntry {
  text: string;
  meaning?: string;
}

export function parseImportText(raw: string): ParsedEntry[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const result: ParsedEntry[] = [];
  for (const line of lines) {
    // try tab, comma, pipe, colon (Chinese colon too)
    const sepMatch =
      line.match(/^(.+?)[\t,|，：:]\s*(.+)$/) ??
      line.match(/^(.+?)\s{2,}(.+)$/); // 2+ spaces
    if (sepMatch) {
      const text = sepMatch[1].trim();
      const meaning = sepMatch[2].trim();
      if (text) result.push({ text, meaning: meaning || undefined });
    } else {
      result.push({ text: line });
    }
  }
  return result;
}

/**
 * Guess a deck name from raw text (first line or first few chars)
 */
export function guessDeckName(raw: string): string {
  const first = raw.trim().split('\n')[0]?.trim() ?? 'Untitled';
  return first.length > 24 ? first.slice(0, 24) + '…' : first;
}
