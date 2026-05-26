# sf-flow-audit

A Salesforce CLI plugin that scans Flow errors and ranks what's on fire.

> Detect + rank only. Groups recent flow failures by error signature, ranks by frequency and recency, and tells you which flows need attention first.

## Install

```bash
sf plugins install @joeo/sf-flow-audit
```

## Usage

```bash
sf flow-audit scan --target-org myorg
sf flow-audit scan --target-org myorg --since 24h --limit 20
sf flow-audit scan --target-org myorg --json
```

## Flags

| Flag | Default | Description |
|---|---|---|
| `--target-org, -o` | (required) | Org alias or username |
| `--since` | `7d` | Window to scan (e.g. `24h`, `7d`, `30d`) |
| `--limit` | `10` | Number of top signatures to return |
| `--json` | off | Emit JSON instead of a table |

## What it does

1. Queries `FlowInterview` records with errors in the time window
2. Normalizes error messages (strips IDs, line numbers, record names)
3. Groups by signature, scores by `recency × frequency`
4. Prints a ranked table

## What it does NOT do

- Inspect flow metadata or pinpoint the failing element (out of scope for v0.1)
- Suggest fixes
- File tickets

## Development

```bash
npm install
npm run build
./bin/dev.js flow-audit scan -o myorg
```

## License

MIT
