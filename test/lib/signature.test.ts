import { expect } from 'chai';
import { signatureOf } from '../../src/lib/signature.js';

describe('signatureOf', () => {
  it('collapses Salesforce IDs', () => {
    const a = signatureOf('Record 0015g00000ABCDeAAA could not be updated');
    const b = signatureOf('Record 0015g00000ZZZZeAAA could not be updated');
    expect(a).to.equal(b);
  });

  it('collapses line/column numbers', () => {
    const a = signatureOf('Formula error at line 42, column 7');
    const b = signatureOf('Formula error at line 99, column 3');
    expect(a).to.equal(b);
  });

  it('collapses timestamps', () => {
    const a = signatureOf('Failed at 2026-05-26T04:29:05.123Z');
    const b = signatureOf('Failed at 2026-01-01T00:00:00Z');
    expect(a).to.equal(b);
  });

  it('collapses US-format timestamps in interview labels', () => {
    const a = signatureOf('Principal Id Match for Dedupe 5/25/2026, 2:31 PM :: Set_Principal_Id_on_Dupe_Account');
    const b = signatureOf('Principal Id Match for Dedupe 12/3/2025, 10:05 AM :: Set_Principal_Id_on_Dupe_Account');
    expect(a).to.equal(b);
  });

  it('handles empty input', () => {
    expect(signatureOf(null)).to.equal('{EMPTY}');
    expect(signatureOf('')).to.equal('{EMPTY}');
  });
});
