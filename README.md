# sf-flow-audit

[![npm version](https://img.shields.io/npm/v/@joeo/sf-flow-audit.svg)](https://www.npmjs.com/package/@joeo/sf-flow-audit)
[![CI](https://github.com/joseph-ortiz/sf-flow-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/joseph-ortiz/sf-flow-audit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@joeo/sf-flow-audit.svg)](LICENSE)

A Salesforce CLI plugin that scans Flow errors and ranks what's on fire.

> Detect + rank only. Groups recent flow failures by error signature, ranks by recency-weighted frequency, and tells you which flows need attention first.

## Install

```bash
sf plugins install @joeo/sf-flow-audit
```

## Usage

### `scan` — rank what's on fire

```bash
sf flow-audit scan --target-org myorg
sf flow-audit scan --target-org myorg --since 24h --limit 20
sf flow-audit scan --target-org myorg --verbose
sf flow-audit scan --target-org myorg --json
```

### `watch` — stream errors in real time

```bash
sf flow-audit watch --target-org myorg
sf flow-audit watch --target-org myorg --duration 5m
sf flow-audit watch --target-org myorg --replay -2          # backfill retained events
sf flow-audit watch --target-org myorg --jsonl > errors.jsonl
```

## Flags

### `scan`

| Flag | Default | Description |
| --- | --- | --- |
| `--target-org, -o` | (required) | Org alias or username |
| `--since` | `7d` | Window to scan (e.g. `24h`, `7d`, `30d`) |
| `--limit` | `10` | Number of top signatures to return |
| `--verbose` | off | After the ranked table, print every raw failure row |
| `--json` | off | Emit JSON instead of a table |

### `watch`

| Flag | Default | Description |
| --- | --- | --- |
| `--target-org, -o` | (required) | Org alias or username |
| `--duration` | (indefinite) | Stop after this duration (e.g. `30s`, `5m`, `1h`) |
| `--replay` | `-1` | Replay-id: `-1` for new events only, `-2` for all retained events (typically last 24-72h) |
| `--jsonl` | off | Emit each event as a JSON line (suitable for piping) |

## Sample output

```
$ sf flow-audit scan -o myorg --since 7d --limit 3

Querying FlowInterview errors in last 7d... found 18

 Score Count Users Flow                                                Element                          Last seen
 ───── ───── ───── ─────────────────────────────────────────────────── ──────────────────────────────── ──────────────
 6.44  12    1     Principal Id Match for Dedupe                       Set_Principal_Id_on_Dupe_Account 2026-05-25T18:31Z
 0.05  3     1     Autolaunched-Consumer-Agentforce-Case Management    Update_Case_2                    2026-05-22T09:43Z
 0.02  2     2     CaseCloseOnStatus                                   CaseCloseOnDisposition           2026-05-21T15:07Z

Sample interview ID for top signature: 0FoWK000008iGPT0A2
```

Pipe to anything via `--json`:

```bash
sf flow-audit scan -o myorg --json | jq '.result.results[] | select(.count > 5)'
sf flow-audit scan -o myorg --json | claude "what's the top issue here?"
```

## How ranking works

For each failure row, we compute a recency-weighted score:

```
weight    = exp(-ageHours / 24)
signature = normalize(flowLabel + element)
score     = sum of weights per signature
```

A half-life of 24h means a failure from 24h ago contributes half as much as one from this hour. The result: a current spike outweighs an old long tail, so the top of the table is what needs attention *now*, not what was loudest two weeks ago.

Signature normalization strips:
- Salesforce IDs (15/18-char) → `{ID}`
- ISO timestamps → `{TS}`
- US-format timestamps Salesforce appends to interview labels (`5/25/2026, 2:31 PM`) → `{TS}`
- `line N`, `column N` → `line {N}`, `column {N}`

## What flow errors does this see?

Two complementary data sources, both available on **any org** (no Event Monitoring license required):

**`scan`** uses `FlowInterview` records where `InterviewStatus = 'Error'`.
- ✅ Historical query (any time window, persisted indefinitely)
- ❌ No error message text — only which flow died, on which element, when

**`watch`** subscribes to the `FlowExecutionErrorEvent` platform event.
- ✅ Full error message text, error code, element, user, flow version
- ✅ Real-time as failures happen
- ⚠️ Limited backfill (`--replay -2` retrieves only what's in the retention window, typically 24–72h)

In practice, use `scan` for "what's been failing all week" and `watch` to drill into "what does the actual error say."

## What it does NOT do (yet)

- Inspect flow metadata or pinpoint the failing element line
- Suggest fixes
- File JIRA / GitHub / ITSM tickets

These are deliberately out of scope. Use `--json` and pipe to your tool of choice.

## Roadmap

- **v0.4** — Setup Audit Trail correlation ("this spike started after deploy X on date Y")
- **v0.5** — Optional `--explain` flag that pipes top signatures to Claude for a likely-cause summary (requires `ANTHROPIC_API_KEY`)
- **v0.6** — `watch --sink slack` / `--sink webhook` for piping events to chat/observability tools

### Known caveats / cleanup

- `watch` uses `process.exit(0)` when `--duration` elapses because `StreamingClient.disconnect()` is private; cleaner shutdown would replace this with a custom Faye client (lets us return the `WatchResult` summary in `--json` mode too).
- `watch --replay <id>` doesn't survive reconnects — if the CometD socket drops, the client re-handshakes at the latest replay-id, not where we were. A persistent replay-id checkpoint (file or org config) would fix this.
- GitHub Actions still pin `actions/checkout@v4` and `setup-node@v4` (Node 20). Need to bump before Node 20 is removed from the runner on **2026-09-16**.

## Development

```bash
git clone https://github.com/joseph-ortiz/sf-flow-audit
cd sf-flow-audit
npm install
npm run build
npm test

# Run against a real org from source
./bin/run.js flow-audit scan -o myorg
```

## Contributing

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Commit messages drive automated version bumps and changelog generation via [release-please](https://github.com/googleapis/release-please).

| Prefix | Bump | Use for |
| --- | --- | --- |
| `feat:` | minor | new feature, flag, command |
| `fix:` | patch | bug fix |
| `chore:` | none | tooling, deps, CI |
| `docs:` | none | README, comments |
| `refactor:` | none | code change with no behavior change |
| `test:` | none | tests only |
| `feat!:` or `BREAKING CHANGE:` footer | major | breaking change |

Releases land via a release-please PR that aggregates commits since the last tag. Merging that PR creates the tag, which triggers the npm publish workflow.

## License

MIT
