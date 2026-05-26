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

```bash
sf flow-audit scan --target-org myorg
sf flow-audit scan --target-org myorg --since 24h --limit 20
sf flow-audit scan --target-org myorg --verbose
sf flow-audit scan --target-org myorg --json
```

## Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--target-org, -o` | (required) | Org alias or username |
| `--since` | `7d` | Window to scan (e.g. `24h`, `7d`, `30d`) |
| `--limit` | `10` | Number of top signatures to return |
| `--verbose` | off | After the ranked table, print every raw failure row |
| `--json` | off | Emit JSON instead of a table |

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

**v0.1 source: `FlowInterview` records where `InterviewStatus = 'Error'`.**

This catches paused / scheduled / autolaunched flow failures that Salesforce persists. It works on **any org** — no Event Monitoring license required.

**What it does NOT include:**
- The actual error message text (FlowInterview doesn't expose it via SOQL)
- Failures that didn't generate a FlowInterview record
- Apex-invoked flow exceptions caught upstream

For richer detail (actual error strings, all flow types), [Event Monitoring](https://help.salesforce.com/s/articleView?id=sf.event_monitoring_intro.htm) and `EventLogFile` are the source of truth. v0.2 will add this as an opt-in `--source eventlog`.

## What it does NOT do (yet)

- Inspect flow metadata or pinpoint the failing element line
- Suggest fixes
- File JIRA / GitHub / ITSM tickets

These are deliberately out of scope. Use `--json` and pipe to your tool of choice.

## Roadmap

- **v0.2** — `--source eventlog` for actual error message text (Event Monitoring orgs)
- **v0.3** — Setup Audit Trail correlation ("this spike started after deploy X on date Y")
- **v0.4** — Optional `--explain` flag that pipes top signatures to Claude for a likely-cause summary (requires `ANTHROPIC_API_KEY`)

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
