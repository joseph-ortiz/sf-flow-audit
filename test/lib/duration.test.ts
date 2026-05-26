import { expect } from 'chai';
import { parseDurationMs } from '../../src/lib/duration.js';

describe('parseDurationMs', () => {
  it('parses seconds', () => {
    expect(parseDurationMs('30s')).to.equal(30_000);
  });

  it('parses minutes', () => {
    expect(parseDurationMs('5m')).to.equal(300_000);
  });

  it('parses hours', () => {
    expect(parseDurationMs('1h')).to.equal(3_600_000);
  });

  it('tolerates whitespace', () => {
    expect(parseDurationMs('  10m  ')).to.equal(600_000);
  });

  it('rejects bad input', () => {
    expect(() => parseDurationMs('5 minutes')).to.throw();
    expect(() => parseDurationMs('forever')).to.throw();
    expect(() => parseDurationMs('-1m')).to.throw();
  });
});
