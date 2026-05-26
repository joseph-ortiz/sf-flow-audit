import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { flowInterviewErrorSoql, parseSince, type FlowInterviewErrorRow } from '../../lib/query.js';
import { rank, type RankedSignature } from '../../lib/rank.js';

export type ScanResult = {
  org: string;
  since: string;
  scanned: number;
  results: RankedSignature[];
};

export default class FlowAuditScan extends SfCommand<ScanResult> {
  public static readonly summary = 'Scan FlowInterview errors and rank what is on fire.';
  public static readonly description =
    'Queries FlowInterview records with InterviewStatus = Error in the given window, ' +
    'groups by flow + current element, and ranks by recency-weighted frequency.';
  public static readonly examples = [
    '<%= config.bin %> <%= command.id %> --target-org myorg',
    '<%= config.bin %> <%= command.id %> --target-org myorg --since 24h --limit 20',
    '<%= config.bin %> <%= command.id %> --target-org myorg --json',
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    since: Flags.string({
      summary: 'Window to scan, e.g. 24h, 7d, 30d.',
      default: '7d',
    }),
    limit: Flags.integer({
      summary: 'Max number of ranked signatures to return.',
      default: 10,
      min: 1,
      max: 200,
    }),
  };

  public async run(): Promise<ScanResult> {
    const { flags } = await this.parse(FlowAuditScan);
    const since = parseSince(flags.since);
    const conn = flags['target-org'].getConnection();
    const username = flags['target-org'].getUsername() ?? 'unknown';

    const soql = flowInterviewErrorSoql(since);
    this.spinner.start(`Querying FlowInterview errors in last ${since.amount}${since.unit}`);
    const result = await conn.query<FlowInterviewErrorRow>(soql);
    this.spinner.stop(`found ${result.totalSize}`);

    const ranked = rank(result.records, flags.limit);

    if (!this.jsonEnabled()) {
      if (ranked.length === 0) {
        this.log(`No flow errors found for ${username} in last ${flags.since}.`);
      } else {
        const tableRows = ranked.map((r) => ({
          score: r.score.toFixed(2),
          count: r.count,
          users: r.distinctUsers,
          flow: r.flowLabel,
          element: r.currentElement ?? '-',
          lastSeen: r.lastSeen,
        }));
        this.table(tableRows, {
          score: { header: 'Score' },
          count: { header: 'Count' },
          users: { header: 'Users' },
          flow: { header: 'Flow' },
          element: { header: 'Element' },
          lastSeen: { header: 'Last seen' },
        });
        this.log('');
        this.log(`Sample interview ID for top signature: ${ranked[0].sampleInterviewId}`);
      }
    }

    return {
      org: username,
      since: flags.since,
      scanned: result.totalSize,
      results: ranked,
    };
  }
}
