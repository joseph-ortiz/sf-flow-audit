// Normalize Flow error messages so that "the same problem" collapses to one signature.
//
// Examples of noise we strip:
//   - Salesforce IDs (15/18 char): 0015g00000ABCDe -> {ID}
//   - Line/column numbers in formula errors: "line 42, column 7" -> "line {N}, column {N}"
//   - ISO timestamps: 2026-05-26T04:29:05.123Z -> {TS}
//   - Quoted record names / strings inside errors -> {STR}
//   - Long numeric runs (record counts, currency) -> {N}

const ID_RE = /\b[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?\b/g;
const TS_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g;
// US-format timestamps Salesforce auto-appends to interview labels,
// e.g. "5/25/2026, 2:31 PM" or "12/3/2025, 10:05 AM"
const US_TS_RE = /\d{1,2}\/\d{1,2}\/\d{2,4},?\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi;
const LINE_RE = /\bline\s+\d+/gi;
const COL_RE = /\bcolumn\s+\d+/gi;
const QUOTED_RE = /"[^"]{1,200}"|'[^']{1,200}'/g;
const NUM_RE = /\b\d{3,}\b/g;

export function signatureOf(rawError: string | null | undefined): string {
  if (!rawError) return '{EMPTY}';
  return rawError
    .replace(TS_RE, '{TS}')
    .replace(US_TS_RE, '{TS}')
    .replace(ID_RE, '{ID}')
    .replace(LINE_RE, 'line {N}')
    .replace(COL_RE, 'column {N}')
    .replace(QUOTED_RE, '{STR}')
    .replace(NUM_RE, '{N}')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
