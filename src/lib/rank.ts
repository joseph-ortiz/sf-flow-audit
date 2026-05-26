import { signatureOf } from './signature.js';
import type { FlowInterviewErrorRow } from './query.js';

export interface RankedSignature {
  signature: string;
  flowLabel: string;
  currentElement: string | null;
  count: number;
  distinctUsers: number;
  firstSeen: string;
  lastSeen: string;
  sampleInterviewId: string;
  score: number;
}

// Recency-weighted frequency score.
//   score = sum over failures of exp(-ageHours / halfLifeHours)
// A half-life of 24h means a failure from 24h ago contributes half as much
// as one from this hour. Tuned so a current spike outweighs an old long tail.
const HALF_LIFE_HOURS = 24;

export function rank(rows: FlowInterviewErrorRow[], limit: number): RankedSignature[] {
  const now = Date.now();
  const buckets = new Map<string, {
    flowLabel: string;
    currentElement: string | null;
    count: number;
    users: Set<string>;
    firstSeen: string;
    lastSeen: string;
    sampleInterviewId: string;
    score: number;
  }>();

  for (const r of rows) {
    // Group by flow label + current element. When v0.2 adds error text, we'll
    // also fold the normalized signature into the key.
    const flowLabel = r.InterviewLabel ?? '(unlabeled)';
    const currentElement = r.CurrentElement;
    const key = signatureOf(`${flowLabel} :: ${currentElement ?? ''}`);

    const ageHours = Math.max(0, (now - Date.parse(r.CreatedDate)) / 3_600_000);
    const weight = Math.exp(-ageHours / HALF_LIFE_HOURS);

    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.users.add(r.CreatedById);
      existing.score += weight;
      if (r.CreatedDate < existing.firstSeen) existing.firstSeen = r.CreatedDate;
      if (r.CreatedDate > existing.lastSeen) {
        existing.lastSeen = r.CreatedDate;
        existing.sampleInterviewId = r.Id;
      }
    } else {
      buckets.set(key, {
        flowLabel,
        currentElement,
        count: 1,
        users: new Set([r.CreatedById]),
        firstSeen: r.CreatedDate,
        lastSeen: r.CreatedDate,
        sampleInterviewId: r.Id,
        score: weight,
      });
    }
  }

  const out: RankedSignature[] = [];
  for (const [signature, b] of buckets) {
    out.push({
      signature,
      flowLabel: b.flowLabel,
      currentElement: b.currentElement,
      count: b.count,
      distinctUsers: b.users.size,
      firstSeen: b.firstSeen,
      lastSeen: b.lastSeen,
      sampleInterviewId: b.sampleInterviewId,
      score: b.score,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
