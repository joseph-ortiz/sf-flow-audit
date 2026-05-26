import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { StreamingClient } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { parseDurationMs } from '../../lib/duration.js';

const CHANNEL = '/event/FlowExecutionErrorEvent';

interface FlowExecutionErrorEventPayload {
  EventDate?: string;
  EventIdentifier?: string;
  EventType?: string;
  ErrorId?: string;
  ErrorMessage?: string;
  ExtendedErrorCode?: string;
  FlowApiName?: string;
  FlowVersionId?: string;
  FlowVersionNumber?: number;
  ElementApiName?: string;
  ElementType?: string;
  InterviewGuid?: string;
  UserId?: string;
  Username?: string;
  CreatedDate?: string;
  [k: string]: unknown;
}

export type WatchResult = {
  org: string;
  channel: string;
  received: number;
  stoppedReason: 'duration' | 'signal';
};

export default class FlowAuditWatch extends SfCommand<WatchResult> {
  public static readonly summary = 'Stream Flow execution errors in real time.';
  public static readonly description =
    'Subscribes to the FlowExecutionErrorEvent platform event and prints each error as it arrives. ' +
    'Unlike scan, this includes the actual error message text. Available on any org (no Event Monitoring license required). ' +
    'Use --replay -2 to also catch retained events (typically the last 24-72h, varies by org).';
  public static readonly examples = [
    '<%= config.bin %> <%= command.id %> --target-org myorg',
    '<%= config.bin %> <%= command.id %> --target-org myorg --duration 5m',
    '<%= config.bin %> <%= command.id %> --target-org myorg --replay -2',
    '<%= config.bin %> <%= command.id %> --target-org myorg --jsonl > flow-errors.jsonl',
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    duration: Flags.string({
      summary: 'Stop streaming after this duration (e.g. 30s, 5m, 1h). Defaults to indefinite until Ctrl-C.',
    }),
    replay: Flags.integer({
      summary: 'Replay-id: -1 for new events only (default), -2 for all retained events on the channel.',
      default: -1,
    }),
    jsonl: Flags.boolean({
      summary: 'Emit each event as a JSON line on stdout (suitable for piping).',
      default: false,
    }),
  };

  public async run(): Promise<WatchResult> {
    const { flags } = await this.parse(FlowAuditWatch);
    const org = flags['target-org'];
    const username = org.getUsername() ?? 'unknown';

    const durationMs = flags.duration ? parseDurationMs(flags.duration) : undefined;
    let received = 0;

    const options = new StreamingClient.DefaultOptions(org, CHANNEL, (message) => {
      received += 1;
      const payload = (message as { payload?: FlowExecutionErrorEventPayload }).payload ?? (message as FlowExecutionErrorEventPayload);

      if (flags.jsonl) {
        this.log(JSON.stringify({ receivedAt: new Date().toISOString(), ...payload }));
      } else {
        const when = payload.EventDate ?? new Date().toISOString();
        const flow = payload.FlowApiName ?? '(unknown flow)';
        const ver = payload.FlowVersionNumber != null ? `v${payload.FlowVersionNumber}` : '';
        const element = payload.ElementApiName ?? '-';
        const user = payload.Username ?? payload.UserId ?? '-';
        const code = payload.ExtendedErrorCode ? `[${payload.ExtendedErrorCode}] ` : '';
        const err = (payload.ErrorMessage ?? '').replace(/\s+/g, ' ').trim();
        this.log(`${when}  ${flow}${ver ? ` (${ver})` : ''}  ::  ${element}  user=${user}  ${code}${err}`);
      }

      return { completed: false };
    });

    // StreamingClient enforces a 3-min minimum on subscribe timeout.
    options.setSubscribeTimeout(Duration.hours(24));
    options.setHandshakeTimeout(Duration.seconds(30));

    const client = await StreamingClient.create(options);
    client.replay(flags.replay);
    await client.handshake();

    if (!flags.jsonl) {
      this.log(`Subscribed to ${CHANNEL} on ${username} (replay=${flags.replay}).`);
      this.log(durationMs ? `Will stop after ${flags.duration}.` : 'Press Ctrl-C to stop.');
      this.log('');
    }

    const finish = (reason: 'duration' | 'signal'): WatchResult => {
      const summary: WatchResult = { org: username, channel: CHANNEL, received, stoppedReason: reason };
      if (!flags.jsonl) {
        this.log('');
        this.log(`Stopped (${reason}). Received ${received} event(s).`);
      }
      return summary;
    };

    const subscribePromise = client.subscribe(async () => undefined).catch(() => undefined);

    if (durationMs) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, durationMs);
      });
      const summary = finish('duration');
      // StreamingClient.disconnect is private; we exit cleanly here to drop the socket.
      // The summary has already been printed.
      setImmediate(() => process.exit(0));
      return summary;
    }

    process.on('SIGINT', () => {
      const summary = finish('signal');
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      process.exit(0);
    });

    await subscribePromise;
    return finish('signal');
  }
}
