// SOQL builders for flow error sources.
//
// v0.1 uses FlowInterview where InterviewStatus = 'Error' as the primary source.
// This works on any org (no Event Monitoring license required) but does NOT
// include the error message text — only which flow died and when.
//
// EventLogFile-backed sources will land in v0.2 behind a --source flag.

export type SinceUnit = 'h' | 'd';

export interface ParsedSince {
  amount: number;
  unit: SinceUnit;
  isoLowerBound: string; // SOQL-safe ISO timestamp
}

export function parseSince(input: string): ParsedSince {
  const m = input.trim().match(/^(\d+)\s*([hd])$/i);
  if (!m) {
    throw new Error(`Invalid --since value: "${input}". Expected formats: 24h, 7d, 30d.`);
  }
  const amount = parseInt(m[1], 10);
  const unit = m[2].toLowerCase() as SinceUnit;
  const ms = unit === 'h' ? amount * 3_600_000 : amount * 86_400_000;
  const since = new Date(Date.now() - ms);
  return {
    amount,
    unit,
    isoLowerBound: since.toISOString(),
  };
}

export interface FlowInterviewErrorRow {
  Id: string;
  InterviewLabel: string | null;
  InterviewStatus: string;
  CurrentElement: string | null;
  CreatedDate: string;
  CreatedById: string;
}

export function flowInterviewErrorSoql(since: ParsedSince, hardLimit = 2000): string {
  return [
    'SELECT Id, InterviewLabel, InterviewStatus, CurrentElement, CreatedDate, CreatedById',
    'FROM FlowInterview',
    `WHERE InterviewStatus = 'Error' AND CreatedDate >= ${since.isoLowerBound}`,
    'ORDER BY CreatedDate DESC',
    `LIMIT ${hardLimit}`,
  ].join(' ');
}
